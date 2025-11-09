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
    // 1️⃣ Get master bin data
    const masterRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_MASTER}`, {
      headers: {
        "X-Master-Key": JSONBIN_API_KEY,
      }
    });

    const masterData = await masterRes.json();
    let movies = masterData.record.movies || [];

    // 2️⃣ Check if movie already has a bin
    let movieEntry = movies.find(m => m.id === movieId);

    if (movieEntry) {
      // ✅ Movie bin exists → return comments
      const movieRes = await fetch(`https://api.jsonbin.io/v3/b/${movieEntry.binId}/latest`, {
        headers: {
          "X-Master-Key": JSONBIN_API_KEY,
        }
      });
      const movieData = await movieRes.json();
      return {
        statusCode: 200,
        body: JSON.stringify({ comments: movieData.record.comments || [] }),
      };
    }

    // 3️⃣ Movie doesn't exist → Create new bin
    const newBinRes = await fetch(`https://api.jsonbin.io/v3/b`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY,
      },
      body: JSON.stringify({ comments: [] })
    });

    const newBinData = await newBinRes.json();
    const newBinId = newBinData.metadata.id;

    // 4️⃣ Update master bin with new movie entry
    const newMovie = { id: movieId, binId: newBinId };
    movies.push(newMovie);

    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_MASTER}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY,
      },
      body: JSON.stringify({ movies })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ comments: [] }), // empty comments for new movie
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error ❌", details: err.message }),
    };
  }
};
