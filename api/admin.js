const crypto = require("crypto");
const { getDb } = require("../lib/db");
const config = require("../lib/config");
const { makeSession, requireAdmin } = require("../lib/auth");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.send(JSON.stringify(body));
}

function makeApiKey() {
  const bytes = crypto.randomBytes(20);
  let out = "";
  for (let i = 0; i < 20; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function baseUrl(req) {
  const configured = String(config.BASE_URL || "").replace(/\/+$/, "");
  if (configured && configured !== "https://your-domain.com") return configured;
  return `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
}

module.exports = async (req, res) => {
  try {
    const action = String(req.query.action || "");

    if (req.method === "POST" && action === "login") {
      const { username, password } = req.body || {};

      if (
        String(username || "") !== String(config.ADMIN_USERNAME) ||
        String(password || "") !== String(config.ADMIN_PASSWORD)
      ) {
        return send(res, 401, { ok: false, message: "Invalid username or password" });
      }

      return send(res, 200, { ok: true, token: makeSession() });
    }

    if (!requireAdmin(req, res)) return;

    const db = await getDb();
    const apiKeys = db.collection("apiKeys");
    const links = db.collection("links");

    if (req.method === "GET" && action === "list") {
      const [keys, shortLinks] = await Promise.all([
        apiKeys.find({}, { projection: { key: 1, usageCount: 1, createdAt: 1, lastUsedAt: 1 } })
          .sort({ createdAt: -1 }).toArray(),
        links.find({}, { projection: { _id: 1, shortCode: 1, url: 1, createdAt: 1, clicks: 1 } })
          .sort({ createdAt: -1 }).toArray()
      ]);

      const keyMap = new Map(keys.map(k => [String(k._id), k.key]));
      const mappedLinks = shortLinks.map(x => ({
        id: x._id,
        shortCode: x.shortCode,
        originalUrl: x.url,
        shortenedUrl: `${baseUrl(req)}/${x.shortCode}`,
        createdAt: x.createdAt,
        clicks: x.clicks || 0,
        apiKey: keyMap.get(String(x.apiKeyId)) || ""
      }));

      return send(res, 200, {
        ok: true,
        apiKeys: keys.map(k => ({
          id: String(k._id),
          key: k.key,
          usageCount: k.usageCount || 0,
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt || null
        })),
        links: mappedLinks
      });
    }

    if (req.method === "POST" && action === "create-key") {
      let key;
      for (let i = 0; i < 10; i++) {
        const candidate = makeApiKey();
        try {
          const result = await apiKeys.insertOne({
            key: candidate,
            usageCount: 0,
            createdAt: new Date()
          });
          key = candidate;
          break;
        } catch (err) {
          if (err.code !== 11000) throw err;
        }
      }

      if (!key) return send(res, 500, { ok: false, message: "Could not create API key" });
      return send(res, 201, { ok: true, key });
    }

    if (req.method === "DELETE" && action === "delete-key") {
      const id = String(req.query.id || "");
      if (!id) return send(res, 400, { ok: false, message: "Missing key id" });

      let keyId;
      try {
        keyId = new (require("mongodb").ObjectId)(id);
      } catch {
        return send(res, 400, { ok: false, message: "Invalid key id" });
      }

      const deleted = await apiKeys.deleteOne({ _id: keyId });
      await links.deleteMany({ apiKeyId: keyId });

      return send(res, 200, {
        ok: true,
        deleted: deleted.deletedCount,
        deletedLinks: true
      });
    }

    if (req.method === "DELETE" && action === "delete-link") {
      const id = String(req.query.id || "");
      if (!id) return send(res, 400, { ok: false, message: "Missing link id" });

      const result = await links.deleteOne({ _id: id });
      return send(res, 200, { ok: true, deleted: result.deletedCount });
    }

    return send(res, 404, { ok: false, message: "Unknown action" });
  } catch (err) {
    console.error(err);
    return send(res, 500, { ok: false, message: "Server error" });
  }
};
