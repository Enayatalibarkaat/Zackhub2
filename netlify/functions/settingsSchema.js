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
    linkShortenerHttpMethod: { type: String, default: "GET" },
    linkShortenerPayloadType: { type: String, default: "query" },
    linkShortenerApiKeyField: { type: String, default: "api" },
    linkShortenerUrlField: { type: String, default: "url" },
    linkShortenerResponsePaths: { type: String, default: "shortenedUrl,shortened_url,short,url,result.url,result.shortenedUrl" },
  },
  { timestamps: true }
);

export default mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
