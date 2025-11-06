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
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  try {
    await connect();

    const data = JSON.parse(event.body);

    const newMovie = new Movie(data);
    await newMovie.save();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Movie added successfully ✅" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
