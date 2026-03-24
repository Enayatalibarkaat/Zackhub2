import { connect, connectStreamLinks } from "./connect.js";
import Movie from "./moviesSchema.js";

const extractStorageId = (url = "") => {
  if (!url) return null;
  // Specifically target the /dl/ID/ pattern shown in your examples
  const match = url.match(/\/dl\/(\d+)\//);
  return match ? match[1] : null;
};

const extractScreenshotLinks = (doc = {}) => {
  if (!doc) return [];
  // Check all possible screenshot fields used by the bot and website
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
    await connect();
    const streamLinksConn = await connectStreamLinks();

    // 1. Fetch all movies from moviesdb
    const movies = await Movie.find().sort({ createdAt: -1 }).lean();

    // 2. Fetch all screenshot documents from StreamLinksDB.movie_screenshots
    let screenshotDocs = [];
    try {
      screenshotDocs = await streamLinksConn.collection("movie_screenshots").find({}).toArray();
    } catch (err) {
      console.warn("Error fetching movie_screenshots collection:", err.message);
    }

    // 3. Map screenshots to movies using robust ID matching
    const enrichedMovies = movies.map((movie) => {
      // Start with screenshots already in the movie doc (if any)
      let movieScreenshots = extractScreenshotLinks(movie);

      // Collect all potential IDs from the movie to match with source_message_id
      const movieIds = new Set();
      
      // Extract IDs from downloadLinks (the /dl/ID/ part)
      if (movie.downloadLinks) {
        movie.downloadLinks.forEach((link) => {
          const id = extractStorageId(link.url);
          if (id) movieIds.add(String(id));
        });
      }
      
      // Extract IDs from telegramLinks (fileId)
      if (movie.telegramLinks) {
        movie.telegramLinks.forEach((link) => {
          if (link.fileId) movieIds.add(String(link.fileId));
        });
      }

      // Extract IDs from seasons (episodes and full season files)
      if (movie.seasons) {
        movie.seasons.forEach((season) => {
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

      // Match with screenshotDocs using source_message_id (as shown in your MongoDB screenshot)
      for (const doc of screenshotDocs) {
        // source_message_id in your screenshot matches the ID from your /dl/ links
        const matchFound = doc.source_message_id && movieIds.has(String(doc.source_message_id));

        if (matchFound) {
          const docScreenshots = extractScreenshotLinks(doc);
          if (docScreenshots.length > 0) {
            // Add these screenshots to the movie, avoiding duplicates
            movieScreenshots = [...new Set([...movieScreenshots, ...docScreenshots])];
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
