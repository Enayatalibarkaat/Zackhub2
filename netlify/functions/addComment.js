// netlify/functions/addComment.js
import { MongoClient, ObjectId } from "mongodb";

// --------- ENV (set ho chuke hain) ----------
const URI = process.env.COMMENTS_MONGODB_URI;
const DB_NAME = process.env.COMMENTS_DB_NAME || "Zackhubme";
const USERS_COL = "users";
const COMMENTS_COL = "comments";

// ---- simple in-memory client cache (lambda cold start ke baad reuse) ----
let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(URI, { maxPoolSize: 5 });
  await client.connect();
  cachedClient = client;
  cachedDb = client.db(DB_NAME);

  // Ensure TTL index once (60 days)
  await cachedDb.collection(COMMENTS_COL).createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 24 * 60 * 60 } // 60 days
  );
  // Helpful indexes
  await cachedDb.collection(COMMENTS_COL).createIndex({ movieId: 1, createdAt: -1 });
  await cachedDb.collection(USERS_COL).createIndex({ username: 1 }, { unique: true });

  return cachedDb;
}

// -------- Username + Profanity checks ----------
const USERNAME_RE = /^[a-z0-9_]{5,}$/; // a-z, 0-9, underscore, min 5

const englishBad = ['fuck','shit','bitch','asshole','cunt','dick','pussy','bastard','whore'];
const hindiBad = ['bhenchod','behenchod','madarchod','chutiya','chutiye','gaandu','randi',
  'bhosdike','bhosda','chod','lund','lauda','kutta','kamina','harami'];
const badWords = [...englishBad, ...hindiBad];

function hasProfanity(text="") {
  const t = String(text).toLowerCase();
  return badWords.some(w => new RegExp(`\\b${w}\\b`, 'i').test(t));
}

// --------------- Handler ----------------
export const handler = async (event) => {
  // Only POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Method Not Allowed ❌" })
    };
  }

  try {
    const { username, movieId, text, parentId = null } = JSON.parse(event.body || "{}");

    // Basic validations
    if (!username || !movieId || !text) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "username, movieId, text required ❌" })
      };
    }

    if (!USERNAME_RE.test(username)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          message: "Invalid username. Use a-z, 0-9, underscore, min 5 chars ❌"
        })
      };
    }

    if (String(text).trim().length > 500) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Comment too long (max 500) ❌" })
      };
    }

    if (hasProfanity(username) || hasProfanity(text)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Inappropriate content blocked ❌" })
      };
    }

    const db = await getDb();

    // Must be a registered user
    const user = await db.collection(USERS_COL).findOne({ username });
    if (!user) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Please register username first ❌" })
      };
    }

    const doc = {
      movieId: String(movieId),
      username: String(username),
      text: String(text).trim(),
      parentId: parentId ? String(parentId) : null,
      createdAt: new Date()
    };

    const res = await db.collection(COMMENTS_COL).insertOne(doc);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: "Comment added ✅",
        comment: { id: String(res.insertedId), ...doc }
      })
    };

  } catch (err) {
    console.error("addComment error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Server error ❌" })
    };
  }
};
