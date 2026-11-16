const crypto = require("crypto");
const config = require("./config");

function hmac(value) {
  return crypto
    .createHmac("sha256", String(config.SESSION_SECRET))
    .update(value)
    .digest("hex");
}

function makeSession() {
  const payload = `${config.ADMIN_USERNAME}|${Date.now()}|${crypto.randomBytes(16).toString("hex")}`;
  return `${Buffer.from(payload).toString("base64url")}.${hmac(payload)}`;
}

function verifySession(token) {
  if (!token) return false;

  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = hmac(payload);

  if (signature.length !== expected.length) return false;

  const ok = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
  if (!ok) return false;

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const parts = decoded.split("|");
  if (parts.length < 3 || parts[0] !== config.ADMIN_USERNAME) return false;

  const created = Number(parts[1]);
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  return Number.isFinite(created) && Date.now() - created < maxAge;
}

function getBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function requireAdmin(req, res) {
  if (!verifySession(getBearer(req))) {
    res.status(401).json({ ok: false, message: "Unauthorized" });
    return false;
  }
  return true;
}

module.exports = { makeSession, requireAdmin };
