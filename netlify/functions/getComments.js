// netlify/functions/getComments.js
import { MongoClient } from "mongodb";

const URI = process.env.COMMENTS_MONGODB_URI;
const DB_NAME = process.env.COMMENTS_DB_NAME || "Zackhubme";
const COMMENTS_COL = "comments";

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(URI, { maxPoolSize: 5 });
  await client.connect();
  cachedClient = client;
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Method Not Allowed ❌" })
    };
  }

  try {
    const movieId = event.queryStringParameters?.movieId;
    // ✅ If admin requests all comments, return everything
if (movieId === 'all') {
  const comments = await commentsCollection.find({}).sort({ createdAt: -1 }).toArray();
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, comments }),
  };
}
    if (!movieId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "movieId is required ❌" })
      };
    }

    const db = await getDb();

    const comments = await db.collection(COMMENTS_COL)
      .find({ movieId: String(movieId) })
      .sort({ createdAt: -1 })
      .toArray();

    // Build nested replies
    const map = {};
    comments.forEach(c => {
      c.id = String(c._id);
      delete c._id;
      c.replies = [];
      map[c.id] = c;
    });

    const roots = [];
    comments.forEach(c => {
      if (c.parentId && map[c.parentId]) {
        map[c.parentId].replies.push(c);
      } else {
        roots.push(c);
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, comments: roots })
    };

  } catch (err) {
    console.error("getComments error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Server error ❌" })
    };
  }
};
