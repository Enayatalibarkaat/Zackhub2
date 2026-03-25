import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, streamLinksConn: null, streamLinksPromise: null };
}

export async function connect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is missing!");

    cached.promise = mongoose
      .connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then((mongoose) => mongoose.connection);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function connectStreamLinks() {
  if (cached.streamLinksConn) return cached.streamLinksConn;

  if (!cached.streamLinksPromise) {
    const uri = process.env.STREAMLINKS_MONGODB_URI || process.env.MONGODB_URI;
    if (!uri) throw new Error("STREAMLINKS_MONGODB_URI is missing!");

    cached.streamLinksPromise = mongoose
      .createConnection(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .asPromise()
      .then(conn => conn.useDb('StreamLinksDB'));
  }

  cached.streamLinksConn = await cached.streamLinksPromise;
  return cached.streamLinksConn;
}
