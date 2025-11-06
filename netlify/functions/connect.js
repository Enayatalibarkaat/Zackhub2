``javascript
import mongoose from "mongoose";
let cached = global.mongoose;
if (!cached) {
cached = global.mongoose = { conn: null, promise: null };
}
export default async function connect() {
if (cached.conn) {
return cached.conn;
}
if (!cached.promise) {
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is missing!");
Plain Text
cached.promise = mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then((mongoose) => {
  return mongoose.connection;
});
}
cached.conn = await cached.promise;
return cached.conn;
}
```
