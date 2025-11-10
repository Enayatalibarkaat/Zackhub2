// netlify/functions/deleteComment.js
import { MongoClient, ObjectId } from "mongodb";

// Enayat ke environment variable names ke hisaab se
const URI = process.env.COMMENTS_MONGODB_URI; // ✅ comments database ke liye
const DB_NAME = process.env.COMMENTS_DB_NAME || "Zackhubme"; // ✅ default rakha
const COMMENTS_COL = process.env.COMMENTS_COLLECTION || "comments"; // ✅ same collection

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Method not allowed ❌" }),
    };
  }

  try {
    const { id } = JSON.parse(event.body || "{}");

    if (!id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Comment ID required ❌" }),
      };
    }

    // ✅ MongoDB se connect karo
    const client = new MongoClient(URI);
    await client.connect();
    const db = client.db(DB_NAME);

    // ✅ ID se comment delete karo
    const result = await db
      .collection(COMMENTS_COL)
      .deleteOne({ _id: new ObjectId(id) });

    await client.close();

    // ✅ Agar delete hua
    if (result.deletedCount > 0) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, message: "Comment deleted ✅" }),
      };
    } else {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, message: "Comment not found ❌" }),
      };
    }
  } catch (err) {
    console.error("deleteComment error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Server error ❌" }),
    };
  }
};
