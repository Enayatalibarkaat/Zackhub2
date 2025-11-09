import fetch from "node-fetch";

const JSONBIN_MASTER = process.env.JSONBIN_MASTER_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed ❌" }),
    };
  }

  const movieId = event.queryStringParameters?.movieId;

  if (!movieId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "movieId is required ❌" }),
    };
  }

  try {
    // 1️⃣ Fetch master bin safely
    const masterRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_MASTER}`, {
      headers: { "X-Master-Key": JSONBIN_API_KEY }
    });

    const masterJson = await masterRes.json();
    const movies = Array.isArray(masterJson?.record?.movies)
      ? masterJson.record.movies
      : [];

    // 2️⃣ Try to find existing movie bin
    const movieEntry = movies.find(m => m?.id === movieId);

    if (movieEntry?.binId) {
      const movieRes = await fetch(`https://api.jsonbin.io/v3/b/${movieEntry.binId}/latest`, {
        headers: { "X-Master-Key": JSONBIN_API_KEY }
      });

      const movieData = await movieRes.json();
      return {
        statusCode: 200,
        body: JSON.stringify({ comments: movieData?.record?.comments || [] }),
      };
    }

    // 3️⃣ No bin found → create new one
    const newBinRes = await fetch(`https://api.jsonbin.io/v3/b`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY,
      },
      body: JSON.stringify({ comments: [] })
    });

    const newBinData = await newBinRes.json();
    const newBinId = newBinData?.metadata?.id;

    if (!newBinId) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to create movie bin ❌" }),
      };
    }

    // 4️⃣ Update master bin
    const updatedMovies = [...movies, { id: movieId, binId: newBinId }];

    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_MASTER}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY,
      },
      body: JSON.stringify({ movies: updatedMovies })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ comments: [] }),
    };

  } catch (err) {
    console.error("🔥 Server Crash:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error ❌", details: err.message }),
    };
  }
};
