import { connect, connectStreamLinks } from "./connect.js";
import Movie from "./moviesSchema.js";

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

// Helper function to clean text for better matching
const cleanText = (text) => {
  if (!text) return "";
  return text.toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all special characters and spaces
    .trim();
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
      
      const cleanMovieTitle = cleanText(movie.title);

      // Matching process - Check every screenshot document
      for (const doc of screenshotDocs) {
        // Match by Title vs movie_key or _id
        const docKey = doc.movie_key ? cleanText(doc.movie_key) : "";
        const docId = doc._id ? cleanText(String(doc._id)) : "";

        // Agar movie ka title, database ke movie_key ya _id ke andar milta hai
        if (
          (docKey && docKey.includes(cleanMovieTitle)) || 
          (docId && docId.includes(cleanMovieTitle)) ||
          (cleanMovieTitle && docKey.includes(cleanMovieTitle.substring(0, 10))) // Match first 10 chars as fallback
        ) {
          const docScreenshots = extractScreenshotLinks(doc);
          if (docScreenshots.length > 0) {
            movieScreenshots = [...new Set([...movieScreenshots, ...docScreenshots])];
          }
        }
      }

      return { 
        ...movie, 
        id: movie._id ? String(movie._id) : movie.id,
        _id: undefined,
        screenshots: movieScreenshots 
      };
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
