import fetch from "node-fetch";

const USERNAMES_BIN_ID = process.env.USERNAMES_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const { username } = JSON.parse(event.body);

    if (!username || username.length < 5) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Username must be at least 5 characters long." }),
      };
    }

    // Fetch existing usernames
    const response = await fetch(`https://api.jsonbin.io/v3/b/${USERNAMES_BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": API_KEY,
      }
    });
    const data = await response.json();
    const existingUsernames = data.record.usernames || [];

    // Check if username already exists
    if (existingUsernames.includes(username)) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "Username already taken." }),
      };
    }

    // Add new username to the list
    existingUsernames.push(username);

    await fetch(`https://api.jsonbin.io/v3/b/${USERNAMES_BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
      },
      body: JSON.stringify({ usernames: existingUsernames }),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };

  } catch (error) {
    console.error("Error in checkUsername:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
