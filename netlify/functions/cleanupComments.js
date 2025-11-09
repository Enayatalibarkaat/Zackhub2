// netlify/functions/cleanupComments.js
import { MongoClient } from "mongodb";

const URI = process.env.COMMENTS_MONGODB_URI;  // Tera env variable
const DB_NAME = process.env.DB_NAME || "Zackhubme"; // Same jaise tu pehle use karta tha
const COLLECTION = process.env.COMMENTS_COLLECTION || "comments"; // Comments collection name

let cachedDb = null;

async function connectToDB() {
  if (cachedDb) return cachedDb;
  if (!URI) throw new Error("COMMENTS_MONGODB_URI not found in environment variables");

  const client = new MongoClient(URI, { maxPoolSize: 5 });
  await client.connect();
  const db = client.db(DB_NAME);
  cachedDb = db;

  // ✅ Ensure TTL index exists — MongoDB will auto delete old comments
  try {
    await db.collection(COLLECTION).createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 60 * 24 * 60 * 60 } // 60 days
    );
    console.log("TTL index ensured on createdAt ✅");
  } catch (err) {
    console.log("TTL index creation skipped:", err.message);
  }

  return db;
}

export const handler = async () => {
  try {
    console.log("🧹 cleanupComments function started...");

    const db = await connectToDB();

    // 60 days ago date
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // delete comments older than 60 days
    const result = await db.collection(COLLECTION).deleteMany({ createdAt: { $lt: cutoff } });

    console.log(`Deleted ${result.deletedCount} old comments (before ${cutoff.toISOString()})`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Old comments cleanup done ✅",
        deletedCount: result.deletedCount,
      }),
    };
  } catch (error) {
    console.error("cleanupComments error ❌:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Server error",
        error: error.message,
      }),
    };
  }
};
