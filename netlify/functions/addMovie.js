import connect from "./connect.js";
import Movie from "./MoviesSchema.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    if (!data || !data.title) {
      return { statusCode: 400, body: JSON.stringify({ error: "Movie title is required" }) };
    }

    await connect();
    const newMovie = new Movie(data);
    await newMovie.save();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Movie added successfully", movie: newMovie }),
    };
  } catch (error) {
    console.error("Error adding movie:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Failed to add movie" }),
    };
  }
};
