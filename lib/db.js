const { MongoClient } = require("mongodb");
const config = require("./config");

let clientPromise = null;
let initialized = false;

async function getDb() {
  if (!config.MONGODB_URI) throw new Error("MONGODB_URI is not set");

  if (!clientPromise) {
    clientPromise = new MongoClient(config.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000
    }).connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }

  const client = await clientPromise;
  const db = client.db(config.DATABASE_NAME || "shortener");

  if (!initialized) {
    const ttlDays = Math.max(1, Number(config.TTL_DAYS || 2));

    await db.collection("links").createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: ttlDays * 86400 }
    );

    await db.collection("apiKeys").createIndex({ key: 1 }, { unique: true });
    await db.collection("links").createIndex({ shortCode: 1 }, { unique: true });

    initialized = true;
  }

  return db;
}

module.exports = { getDb };
