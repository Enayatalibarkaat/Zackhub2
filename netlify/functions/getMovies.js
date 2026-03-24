import { connect, connectStreamLinks } from "./connect.js";
import Movie from "./moviesSchema.js";

const extractStorageId = (url = "") => {
  if (!url) return null;
  // Capture the ID between /dl/ and the next /
  const match = url.match(/\/dl\/(\d+)\//);
  return match ? match[1] : null;
};

const extractScreenshotLinks = (doc = {}) => {
  if (!doc) return [];
  // Standard fields for screenshots across bot and web
  const fields = ['screenshots', 'screenshot_preview_links', 'screenshot_links', 'screenshotPreviewLinks', 'screenshotLinks'];
  for (const field of fields) {
    if (Array.isArray(doc[field]) && doc[field].length > 0) {
      return doc[field].filter((s) => typeof s === "string" && s.trim());
    }
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

    // 1. Fetch movies
    const movies = await Movie.find().sort({ createdAt: -1 }).lean();

    // 2. Fetch screenshots
    let screenshotDocs = [];
    try {
      screenshotDocs = await streamLinksConn.collection("movie_screenshots").find({}).toArray();
      console.log(`[LOG] Fetched ${screenshotDocs.length} screenshot docs from StreamLinksDB`);
    } catch (err) {
      console.error("[ERROR] Failed to fetch screenshots:", err.message);
    }

    // 3. Match logic
    const enrichedMovies = movies.map((movie) => {
      let movieScreenshots = extractScreenshotLinks(movie);
      
      // Store IDs as strings for easy comparison
      const movieIds = new Set();
      const addId = (id) => { if (id) movieIds.add(String(id)); };

      // Get IDs from download links
      if (movie.downloadLinks) {
        movie.downloadLinks.forEach(l => addId(extractStorageId(l.url)));
      }
      
      // Get IDs from telegram links
      if (movie.telegramLinks) {
        movie.telegramLinks.forEach(l => addId(l.fileId));
      }
      
      // Get IDs from seasons/episodes
      if (movie.seasons) {
        movie.seasons.forEach(s => {
          if (s.fullSeasonFiles) {
            s.fullSeasonFiles.forEach(f => {
              if (f.downloadLinks) f.downloadLinks.forEach(l => addId(extractStorageId(l.url)));
              if (f.telegramLinks) f.telegramLinks.forEach(l => addId(l.fileId));
            });
          }
          if (s.episodes) {
            s.episodes.forEach(e => {
              if (e.downloadLinks) e.downloadLinks.forEach(l => addId(extractStorageId(l.url)));
              if (e.telegramLinks) e.telegramLinks.forEach(l => addId(l.fileId));
            });
          }
        });
      }

      // Matching process - Check every screenshot document
      for (const doc of screenshotDocs) {
        // Try to match by source_message_id, file_id, OR the document's _id
        const sourceId = doc.source_message_id ? String(doc.source_message_id) : null;
        const fileId = doc.file_id ? String(doc.file_id) : null;
        const docId = doc._id ? String(doc._id) : null;

        if (
          (sourceId && movieIds.has(sourceId)) || 
          (fileId && movieIds.has(fileId)) ||
          (docId && movieIds.has(docId))
        ) {
          const docScreenshots = extractScreenshotLinks(doc);
          if (docScreenshots.length > 0) {
            movieScreenshots = [...new Set([...movieScreenshots, ...docScreenshots])];
          }
        }
      }

      return { ...movie, screenshots: movieScreenshots };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ movies: enrichedMovies }),
    };
  } catch (error) {
    console.error("[CRITICAL ERROR]:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
