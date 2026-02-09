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
    const { commentId, voteType, reactorId } = JSON.parse(event.body || "{}");

    if (!commentId || !voteType || !reactorId || !["like", "dislike"].includes(voteType)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "commentId, reactorId and valid voteType required ❌" }),
      };
    }

    const db = await getDb();
    const comments = db.collection(COMMENTS_COL);
    const id = new ObjectId(String(commentId));

    const doc = await comments.findOne({ _id: id });
    if (!doc) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Comment not found ❌" }),
      };
    }

    const likedBy = Array.isArray(doc.likedBy) ? doc.likedBy : [];
    const dislikedBy = Array.isArray(doc.dislikedBy) ? doc.dislikedBy : [];

    const hasLiked = likedBy.includes(reactorId);
    const hasDisliked = dislikedBy.includes(reactorId);

    let nextLikedBy = [...likedBy];
    let nextDislikedBy = [...dislikedBy];

    if (voteType === "like") {
      if (hasLiked) {
        nextLikedBy = nextLikedBy.filter((id) => id !== reactorId);
      } else {
        nextLikedBy.push(reactorId);
        if (hasDisliked) {
          nextDislikedBy = nextDislikedBy.filter((id) => id !== reactorId);
        }
      }
    }

    if (voteType === "dislike") {
      if (hasDisliked) {
        nextDislikedBy = nextDislikedBy.filter((id) => id !== reactorId);
      } else {
        nextDislikedBy.push(reactorId);
        if (hasLiked) {
          nextLikedBy = nextLikedBy.filter((id) => id !== reactorId);
        }
      }
    }

    const likes = nextLikedBy.length;
    const dislikes = nextDislikedBy.length;

    await comments.updateOne(
      { _id: id },
      {
        $set: {
          likedBy: nextLikedBy,
          dislikedBy: nextDislikedBy,
          likes,
          dislikes,
        },
      }
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, likes, dislikes }),
    };
  } catch (err) {
    console.error("voteComment error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Server error ❌" }),
    };
  }
};
