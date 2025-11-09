import fetch from "node-fetch";

const BIN_ID = "PASTE_YOUR_BIN_ID_HERE";
const API_KEY = process.env.JSONBIN_SECRET_KEY;
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

exports.handler = async (event) => {
  const method = event.httpMethod;

  try {
    // ✅ Load comments
    if (method === "GET") {
      const response = await fetch(BIN_URL, {
        headers: {
          "X-Master-Key": API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch comments from JSONBin");
      }

      const data = await response.json();
      const comments = data.record || [];

      // Remove comments older than 60 days
      const now = new Date();
      const updatedComments = comments.filter((c) => {
        const commentDate = new Date(c.timestamp);
        const diffTime = (now.getTime() - commentDate.getTime()) / (1000 * 3600 * 24);
        return diffTime < 60;
      });

      if (updatedComments.length !== comments.length) {
        await saveCommentsToJSONBin(updatedComments);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ comments: updatedComments }),
      };
    }

    // ✅ Save new comment
    if (method === "POST") {
      const newComment = JSON.parse(event.body);

      const response = await fetch(BIN_URL, {
        headers: {
          "X-Master-Key": API_KEY,
        },
      });

      const data = await response.json();
      const comments = data.record || [];

      comments.push(newComment);
      await saveCommentsToJSONBin(comments);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
      };
    }

    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  } catch (error) {
    console.error("Error in comments function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error" }),
    };
  }
};

async function saveCommentsToJSONBin(comments) {
  await fetch(BIN_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": API_KEY,
    },
    body: JSON.stringify(comments),
  });
}
