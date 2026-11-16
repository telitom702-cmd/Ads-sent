const crypto = require("crypto");
const { getDb } = require("../lib/db");
const config = require("../lib/config");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
}

function makeCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function getBaseUrl(req) {
  const configured = String(config.BASE_URL || "").replace(/\/+$/, "");
  if (configured && configured !== "https://your-domain.com") return configured;
  return `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return send(res, 405, { status: "error", message: "Method not allowed" });
    }

    const { api, url, format } = req.query;

    if (!api) return send(res, 401, { status: "error", message: "API key is required" });
    if (!url) return send(res, 400, { status: "error", message: "URL is required" });

    const db = await getDb();
    const keyDoc = await db.collection("apiKeys").findOne({ key: String(api) });

    if (!keyDoc) {
      return send(res, 401, { status: "error", message: "Invalid API key" });
    }

    let parsed;
    try {
      parsed = new URL(String(url));
    } catch {
      return send(res, 400, { status: "error", message: "Invalid URL" });
    }

    if (!/^https?:$/.test(parsed.protocol)) {
      return send(res, 400, { status: "error", message: "Only http/https URLs are allowed" });
    }

    const links = db.collection("links");
    let code = null;
    const length = Math.max(4, Number(config.SHORT_CODE_LENGTH || 6));

    for (let i = 0; i < 10; i++) {
      const shortCode = makeCode(length);
      try {
        await links.insertOne({
          _id: shortCode,
          shortCode,
          url: parsed.toString(),
          apiKeyId: keyDoc._id,
          createdAt: new Date(),
          clicks: 0
        });
        code = shortCode;
        break;
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }

    if (!code) {
      return send(res, 500, { status: "error", message: "Could not create short URL" });
    }

    await db.collection("apiKeys").updateOne(
      { _id: keyDoc._id },
      { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
    );

    const shortenedUrl = `${getBaseUrl(req)}/${code}`;

    if (String(format).toLowerCase() === "text") {
      res.status(200).setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(shortenedUrl);
    }

    return send(res, 200, {
      status: "success",
      shortenedUrl,
      shortCode: code
    });
  } catch (err) {
    console.error(err);
    return send(res, 500, { status: "error", message: "Server error" });
  }
};
