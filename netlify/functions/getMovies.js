import connect from "./connect.js";
import Movie from "./moviesSchema.js";

export const handler = async () => {
  try {
    await connect();
    const movies = await Movie.find().sort({ createdAt: -1 }).lean();
    return {
      statusCode: 200,
      body: JSON.stringify({ movies }),
    };
  } catch (error) {
    console.error("Error fetching movies:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to load movies" }),
    };
  }
};
