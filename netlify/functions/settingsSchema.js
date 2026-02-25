import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    enableTelegramForNewMovies: { type: Boolean, default: false },
    enableTelegramGlobally: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
