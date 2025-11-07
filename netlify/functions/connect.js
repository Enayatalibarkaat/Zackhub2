import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;

export const connectDB = async () => {
  if (!uri) throw new Error("MONGODB_URI is missing!");

  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};
