import connect from "./connect.js";
import mongoose from "mongoose";

const movieSchema = new mongoose.Schema({
  title: String,
  poster: String,
  year: String,
  description: String,
});

const Movie = mongoose.models.Movie || mongoose.model("Movie", movieSchema);

export async function handler(event, context) {
  if (event.httpMethod !== "DELETE") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  try {
    await connect();

    const { id } = JSON.parse(event.body);

    const deleted = await Movie.findByIdAndDelete(id);

    if (!deleted) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Movie not found ❌" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Movie deleted successfully ✅" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
