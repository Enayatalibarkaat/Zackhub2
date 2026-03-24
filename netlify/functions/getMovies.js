import { connect, connectStreamLinks } from "./connect.js";
import Movie from "./moviesSchema.js";

const extractStorageId = (url = "") => {
  if (!url) return null;
  const match = url.match(/\/dl\/(\d+)\//);
  return match ? match[1] : null;
};

const extractScreenshotLinks = (doc = {}) => {
  if (!doc) return [];
  if (Array.isArray(doc.screenshots) && doc.screenshots.length > 0) {
    return doc.screenshots.filter((s) => typeof s === "string" && s.trim());
  }
  if (Array.isArray(doc.screenshot_preview_links) && doc.screenshot_preview_links.length > 0) {
    return doc.screenshot_preview_links.filter((s) => typeof s === "string" && s.trim());
  }
  if (Array.isArray(doc.screenshot_links) && doc.screenshot_links.length > 0) {
    return doc.screenshot_links.filter((s) => typeof s === "string" && s.trim());
  }
  return [];
};

export const handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  try {
    const mainConn = await connect();
    const streamLinksConn = await connectStreamLinks();

    // Fetch movies from moviesdb
    const movies = await Movie.find().sort({ createdAt: -1 }).lean();

    // Fetch screenshots from StreamLinksDB
    let screenshotDocs = [];
    try {
      screenshotDocs = await streamLinksConn.collection("movie_screenshots").find({}).toArray();
    } catch (err) {
      console.warn("Error fetching movie_screenshots collection:", err.message);
    }

    // Map screenshots to movies
    const enrichedMovies = movies.map((movie) => {
      let movieScreenshots = extractScreenshotLinks(movie);

      // If screenshots are empty in moviesdb, look into StreamLinksDB.movie_screenshots
      if (movieScreenshots.length === 0) {
        // Collect all potential IDs from the movie to match with source_message_id or file_id
        const movieIds = new Set();
        
        // Add the movie's own ID if it exists
        if (movie.id) movieIds.add(String(movie.id));
        if (movie._id) movieIds.add(String(movie._id));

        // 1. Check movie.downloadLinks
        if (movie.downloadLinks) {
          movie.downloadLinks.forEach((link) => {
            const id = extractStorageId(link.url);
            if (id) movieIds.add(String(id));
          });
        }
        
        // 2. Check movie.telegramLinks
        if (movie.telegramLinks) {
          movie.telegramLinks.forEach((link) => {
            if (link.fileId) movieIds.add(String(link.fileId));
          });
        }

        // 3. Check seasons for TV shows (episodes and full season files)
        if (movie.seasons) {
          movie.seasons.forEach((season) => {
            // Check full season files
            if (season.fullSeasonFiles) {
              season.fullSeasonFiles.forEach((file) => {
                file.downloadLinks?.forEach((link) => {
                  const id = extractStorageId(link.url);
                  if (id) movieIds.add(String(id));
                });
                file.telegramLinks?.forEach((link) => {
                  if (link.fileId) movieIds.add(String(link.fileId));
                });
              });
            }
            // Check individual episodes
            if (season.episodes) {
              season.episodes.forEach((episode) => {
                episode.downloadLinks?.forEach((link) => {
                  const id = extractStorageId(link.url);
                  if (id) movieIds.add(String(id));
                });
                episode.telegramLinks?.forEach((link) => {
                  if (link.fileId) movieIds.add(String(link.fileId));
                });
              });
            }
          });
        }

        // Match with screenshotDocs using source_message_id OR file_id
        for (const doc of screenshotDocs) {
          const matchFound = 
            (doc.source_message_id && movieIds.has(String(doc.source_message_id))) ||
            (doc.file_id && movieIds.has(String(doc.file_id)));

          if (matchFound) {
            movieScreenshots = extractScreenshotLinks(doc);
            if (movieScreenshots.length > 0) break;
          }
        }
      }

      return {
        ...movie,
        screenshots: movieScreenshots,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ movies: enrichedMovies }),
    };
  } catch (error) {
    console.error("Error fetching movies:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to load movies" }),
    };
  }
};
