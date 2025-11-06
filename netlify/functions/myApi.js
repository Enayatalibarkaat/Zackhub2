import { connect } from "./connect.js";
import mongoose from "mongoose";

const MovieSchema = new mongoose.Schema({
  title: String,
  poster: String,
  year: String,
});

const Movie =
  mongoose.models.Movie || mongoose.model("Movie", MovieSchema);

export async function handler(event) {
  try {
    await connect();

    if (event.httpMethod === "GET") {
      const movies = await Movie.find().lean();
      return {
        statusCode: 200,
        body: JSON.stringify({ movies }),
      };
    }

    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body || "{}");
      await Movie.create(data);
      return {
        statusCode: 201,
        body: JSON.stringify({ message: "Movie stored ✅" }),
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
}
