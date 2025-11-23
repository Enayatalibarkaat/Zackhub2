import { connect } from "./connect.js";
import Movie from "./moviesSchema.js";

export const handler = async () => {
  // --- ONLY CHANGE: Added Headers for Caching & Speed ---
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    // Ye line data ko 1 ghante tak CDN par save rakhegi (Instant Load)
    "Cache-Control": "public, max-age=300, s-maxage=3600"
  };

  try {
    await connect();
    const movies = await Movie.find().sort({ createdAt: -1 }).lean();
    return {
      statusCode: 200,
      headers, // Yahan headers add kiya hai
      body: JSON.stringify({ movies }),
    };
  } catch (error) {
    console.error("Error fetching movies:", error);
    return {
      statusCode: 500,
      headers, // Yahan bhi headers add kiya hai (Error safety ke liye)
      body: JSON.stringify({ error: "Failed to load movies" }),
    };
  }
};
