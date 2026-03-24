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
      const movieIds = new Set();
      
      // Collect all IDs from various link types
      const addId = (id) => { if (id) movieIds.add(String(id)); };

      if (movie.downloadLinks) movie.downloadLinks.forEach(l => addId(extractStorageId(l.url)));
      if (movie.telegramLinks) movie.telegramLinks.forEach(l => addId(l.fileId));
      
      if (movie.seasons) {
        movie.seasons.forEach(s => {
          if (s.fullSeasonFiles) s.fullSeasonFiles.forEach(f => {
            f.downloadLinks?.forEach(l => addId(extractStorageId(l.url)));
            f.telegramLinks?.forEach(l => addId(l.fileId));
          });
          if (s.episodes) s.episodes.forEach(e => {
            e.downloadLinks?.forEach(l => addId(extractStorageId(l.url)));
            e.telegramLinks?.forEach(l => addId(l.fileId));
          });
        });
      }

      // Matching process
      for (const doc of screenshotDocs) {
        // IMPORTANT: source_message_id might be stored as a Number in DB, but movieIds has Strings
        const sourceId = doc.source_message_id ? String(doc.source_message_id) : null;
        const fileId = doc.file_id ? String(doc.file_id) : null;

        if ((sourceId && movieIds.has(sourceId)) || (fileId && movieIds.has(fileId))) {
          const docScreenshots = extractScreenshotLinks(doc);
          if (docScreenshots.length > 0) {
            movieScreenshots = [...new Set([...movieScreenshots, ...docScreenshots])];
            console.log(`[LOG] Matched movie "${movie.title}" with screenshots via ID: ${sourceId || fileId}`);
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
