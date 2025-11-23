import { connect } from "./connect.js";
import Movie from "./moviesSchema.js";

export const handler = async (event, context) => {
  // --- SMART CACHING HEADERS ---
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    // s-maxage=60: 60 second tak data super fast load hoga (Cache se).
    // stale-while-revalidate=600: Agar 60 sec se purana data hai, to user ko wahi dikhao 
    // lekin background me chupke se naya data update kar lo.
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600"
  };

  // Handle Preflight requests
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  try {
    await connect();
    
    // Data fetch query
    const movies = await Movie.find()
      .sort({ createdAt: -1 })
      .lean(); // .lean() makes it faster

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ movies }),
    };
  } catch (error) {
    console.error("Error fetching movies:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to load movies" }),
    };
  }
};
