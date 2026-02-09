import { MongoClient, ObjectId } from "mongodb";

const URI = process.env.COMMENTS_MONGODB_URI;
const DB_NAME = process.env.COMMENTS_DB_NAME || "Zackhubme";
const COMMENTS_COL = "comments";

let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(URI, { maxPoolSize: 5 });
  await client.connect();
  cachedDb = client.db(DB_NAME);

  await cachedDb.collection(COMMENTS_COL).createIndex({ movieId: 1, createdAt: -1 });
  await cachedDb.collection(COMMENTS_COL).createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

  return cachedDb;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Method Not Allowed ❌" }),
    };
  }

  try {
    const { username = "Admin", movieId, text, parentId } = JSON.parse(event.body || "{}");

    if (!movieId || !text || !parentId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "movieId, text, parentId required ❌" }),
      };
    }

    const db = await getDb();
    const commentsCol = db.collection(COMMENTS_COL);

    const parent = await commentsCol.findOne({ _id: new ObjectId(String(parentId)) });
    if (!parent) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Parent comment not found ❌" }),
      };
    }

    const cleanText = String(text).trim();
    if (!cleanText) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Reply cannot be empty ❌" }),
      };
    }

    const doc = {
      movieId: String(movieId),
      username: String(username || "Admin"),
      text: cleanText,
      parentId: String(parentId),
      createdAt: new Date(),
      isAdminReply: true,
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
    };

    const res = await commentsCol.insertOne(doc);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, message: "Reply sent ✅", comment: { id: String(res.insertedId), ...doc } }),
    };
  } catch (err) {
    console.error("addAdminReply error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Server error ❌" }),
    };
  }
};
