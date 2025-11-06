import mongoose from "mongoose";

let cached = global.mongoose;

export async function connect() {
  if (cached && cached.connection.readyState === 1) {
    return cached.connection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing!");

  const conn = await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  global.mongoose = { connection: conn.connection };
  return conn.connection;
}
