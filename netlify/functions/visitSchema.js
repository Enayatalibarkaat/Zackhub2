import mongoose from "mongoose";

const visitSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  page: { type: String, default: "/" },
  visitedAt: { type: Date, default: Date.now }
});

// --- MAGIC LINE (AUTO DELETE) ---
// Ye line MongoDB ko bolti hai: "visitedAt" date ke 30 din (2592000 seconds) baad
// is data ko automatically delete kar dena.
visitSchema.index({ visitedAt: 1 }, { expireAfterSeconds: 2592000 });

const Visit = mongoose.models.Visit || mongoose.model("Visit", visitSchema);

export default Visit;
