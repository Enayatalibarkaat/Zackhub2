import { connect } from "./connect.js";
import Movie from "./moviesSchema.js";

export const handler = async (event) => {
  if (event.httpMethod !== "DELETE") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { id } = JSON.parse(event.body || "{}");

    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Movie ID is required" }) };
    }

    await connect();
    const deletedMovie = await Movie.findByIdAndDelete(id);

    if (!deletedMovie) {
      return { statusCode: 404, body: JSON.stringify({ error: "Movie not found" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Movie deleted successfully", movie: deletedMovie }),
    };
  } catch (error) {
    console.error("Error deleting movie:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Failed to delete movie" }),
    };
  }
};
