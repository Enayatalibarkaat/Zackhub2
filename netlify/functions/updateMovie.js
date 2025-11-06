import connect from "./connect.js";
import Movie from "./moviesSchema.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    if (!data.id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Movie ID is required" }) };
    }

    await connect();

    const updatedMovie = await Movie.findByIdAndUpdate(data.id, data, {
      new: true,
      runValidators: true,
    });

    if (!updatedMovie) {
      return { statusCode: 404, body: JSON.stringify({ error: "Movie not found" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Movie updated successfully", movie: updatedMovie }),
    };
  } catch (error) {
    console.error("Error updating movie:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Failed to update movie" }),
    };
  }
};
