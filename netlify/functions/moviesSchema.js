import mongoose from "mongoose";

const DownloadLinkSchema = new mongoose.Schema({
  quality: String,
  url: String,
});

const TelegramLinkSchema = new mongoose.Schema({
  quality: String,
  fileId: String,
});

const FullSeasonFileSchema = new mongoose.Schema({
  title: String,
  downloadLinks: [DownloadLinkSchema],
  telegramLinks: [TelegramLinkSchema],
});

const EpisodeSchema = new mongoose.Schema({
  episodeNumber: Number,
  title: String,
  downloadLinks: [DownloadLinkSchema],
  telegramLinks: [TelegramLinkSchema],
});

const SeasonSchema = new mongoose.Schema({
  seasonNumber: Number,
  episodes: [EpisodeSchema],
  fullSeasonFiles: [FullSeasonFileSchema], // NEW ADDITION
});

const GenreSchema = new mongoose.Schema({
  id: Number,
  name: String,
});

const MovieSchema = new mongoose.Schema(
  {
    title: String,
    posterUrl: String,
    backdropUrl: String,
    description: String,
    category: String,
    actors: String,
    director: String,
    producer: String,
    rating: Number,
    downloadLinks: [DownloadLinkSchema],
    telegramLinks: [TelegramLinkSchema],
    seasons: [SeasonSchema],
    trailerLink: String,
    genres: [GenreSchema],
    releaseDate: String,
    runtime: Number,
    tagline: String,
    isRecommended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Movie || mongoose.model("Movie", MovieSchema);
