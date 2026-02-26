import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    enableTelegramForNewMovies: { type: Boolean, default: false },
    enableTelegramGlobally: { type: Boolean, default: true },
    linkShortenerEnabled: { type: Boolean, default: false },
    linkShortenerName: { type: String, default: "" },
    linkShortenerApiKey: { type: String, default: "" },
    linkShortenerApiUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
