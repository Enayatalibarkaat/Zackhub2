// netlify/functions/registerUser.js
import mongoose from "mongoose";

/** ---------- ENV ---------- **/
const BASE_URI = process.env.MONGO_URI; // comments ke liye naya URI (movies se alag)
const DB_NAME  = process.env.DB_NAME || "Zackhubme";

/** ---------- Safe Mongo URI with DB ---------- **/
function buildUriWithDb(base, dbName) {
  // base examples: mongodb+srv://user:pass@cluster/ ?appName=Cluster0
  // result: .../Zackhubme?appName=Cluster0
  const [left, right = ""] = base.split("?");
  const hasTrailingSlash = left.endsWith("/");
  const leftWithDb = hasTrailingSlash ? `${left}${dbName}` : `${left}/${dbName}`;
  return right ? `${leftWithDb}?${right}` : leftWithDb;
}

const FULL_URI = buildUriWithDb(BASE_URI, DB_NAME);

/** ---------- Profanity List (EN + HI) ---------- **/
const EN = ["fuck","shit","bitch","asshole","cunt","dick","pussy","bastard","whore"];
const HI = [
  "bhenchod","behenchod","madarchod","chutiya","chutiye","gaandu","randi",
  "bhosdike","bhosda","chod","lund","lauda","kutta","kamina","harami"
];
const BAD_WORDS = [...EN, ...HI].map(w => w.toLowerCase());

function hasProfanity(str = "") {
  const txt = String(str).toLowerCase();
  return BAD_WORDS.some(w => new RegExp(`\\b${w}\\b`, "i").test(txt));
}

/** ---------- Mongoose Connection (cached) ---------- **/
let cached = global._users_mongoose;
if (!cached) {
  cached = global._users_mongoose = { conn: null, promise: null };
}

async function connectUsersDb() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .createConnection(FULL_URI, {
        // separate pooled connection for comments/users
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
      })
      .asPromise();
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

/** ---------- User Model (case-insensitive uniqueness) ---------- **/
let User;
async function getUserModel() {
  const conn = await connectUsersDb();
  if (User) return User;

  const schema = new mongoose.Schema(
    {
      username: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 30,
        match: [/^[a-z0-9_]{5,}$/, "Invalid username format"],
        trim: true,
      },
      normalized: {
        type: String,
        required: true, // username.toLowerCase()
        index: true,
        unique: true,   // enforce uniqueness on normalized
      },
    },
    { timestamps: true, collection: "users" }
  );

  // Extra safety: ensure unique index on normalized
  schema.index({ normalized: 1 }, { unique: true });

  User = conn.model("User", schema);
  return User;
}

/** ---------- Handler ---------- **/
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: "Method Not Allowed ❌" }),
    };
  }

  try {
    const { username } = JSON.parse(event.body || "{}");

    // 1) Validate presence
    if (!username) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: "Username is required ❌" }),
      };
    }

    // 2) Validate format: a-z 0-9 _ , min 5, no spaces
    const trimmed = String(username).trim();
    if (!/^[a-z0-9_]{5,}$/.test(trimmed)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Only a-z, 0-9, underscore (_) and min 5 chars allowed ❌",
        }),
      };
    }

    // 3) Profanity check
    if (hasProfanity(trimmed)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: "Bad words not allowed ❌" }),
      };
    }

    // 4) Save if not taken (case-insensitive)
    const UserModel = await getUserModel();
    const norm = trimmed.toLowerCase();

    const existing = await UserModel.findOne({ normalized: norm }).lean();
    if (existing) {
      return {
        statusCode: 409,
        body: JSON.stringify({ success: false, message: "Username already exists ❌" }),
      };
    }

    await UserModel.create({ username: trimmed, normalized: norm });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Username registered ✅" }),
    };
  } catch (err) {
    console.error("registerUser error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "Server error ❌" }),
    };
  }
};
