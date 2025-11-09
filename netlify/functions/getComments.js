// netlify/functions/getComments.js
import { MongoClient } from "mongodb";

// ---- ENV (Netlify) ----
// MONGODB_URI_COMMENTS  -> comments DB ka connection string
// MONGODB_DB            -> database name (e.g. Zackhubme)
// MONGODB_COLLECTION_COMMENTS -> collection name (default: comments)

const MONGO_URI = process.env.MONGODB_URI_COMMENTS;
const DB_NAME = process.env.MONGODB_DB || "Zackhubme";
const COMMENTS_COL = process.env.MONGODB_COLLECTION_COMMENTS || "comments";

// Global cache for Netlify hot re-use
let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb && cachedClient) return cachedDb;
  if (!MONGO_URI) throw new Error("MONGODB_URI_COMMENTS missing");
  const client = new MongoClient(MONGO_URI, { maxPoolSize: 5 });
  await client.connect();
  cachedClient = client;
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

function buildTree(flat) {
  const byId = new Map();
  flat.forEach((c) => byId.set(c.id, { ...c, replies: [] }));

  const roots = [];

  for (const c of byId.values()) {
    if (c.parentId) {
      const parent = byId.get(c.parentId);
      if (parent) parent.replies.push(c);
      else roots.push(c); // safety: parent missing -> treat as root
    } else {
      roots.push(c);
    }
  }

  // Replies oldest first
  const sortReplies = (node) => {
    node.replies.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    node.replies.forEach(sortReplies);
  };

  // Roots newest first
  roots.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  roots.forEach(sortReplies);

  return roots;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        body: JSON.stringify({ success: false, message: "Method Not Allowed ❌" }),
      };
    }

    const movieId = event.queryStringParameters?.movieId?.trim();
    if (!movieId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: "movieId required ❌" }),
      };
    }

    const db = await getDb();
    const col = db.collection(COMMENTS_COL);

    // Sirf is movie ke comments lao (flat list)
    const flat = await col
      .find({ movieId })
      .project({ _id: 0 }) // Mongo _id frontend ko nahi chahiye
      .sort({ createdAt: 1 }) // base order; tree me root/replies alag sort karenge
      .limit(2000) // safety cap
      .toArray();

    const tree = buildTree(flat);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, movieId, comments: tree }),
    };
  } catch (err) {
    console.error("getComments error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Server error ❌" }),
    };
  }
};
