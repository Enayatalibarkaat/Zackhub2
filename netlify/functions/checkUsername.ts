import type { Handler } from "@netlify/functions";

const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY!;
const BIN_ID = process.env.JSONBIN_BIN_ID!;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { username } = JSON.parse(event.body || "{}");
  if (!username) {
    return { statusCode: 400, body: "Missing username" };
  }

  try {
    // Get current username list
    const getReq = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      headers: { "X-Master-Key": JSONBIN_API_KEY }
    });
    const data = await getReq.json();
    const usernames: string[] = data.record || [];

    // If username exists → reject
    if (usernames.some(u => u.toLowerCase() === username.toLowerCase())) {
      return { statusCode: 409, body: "Username already taken" };
    }

    // Add new username
    const updated = [...usernames, username];

    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY
      },
      body: JSON.stringify(updated)
    });

    return { statusCode: 200, body: "Username registered" };

  } catch (err) {
    console.error("Server error:", err);
    return { statusCode: 500, body: "Server error" };
  }
};
