import { connect } from "./connect.js";
import Movie from "./moviesSchema.js";

const normalizeKey = (value = "") => {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\.(mkv|mp4|avi|mov|webm)$/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
};

const extractScreenshotLinks = (doc = {}) => {
  if (!doc) return [];
  
  // Try screenshots first
  if (Array.isArray(doc.screenshots) && doc.screenshots.length > 0) {
    return doc.screenshots.filter(s => typeof s === "string" && s.trim());
  }
  
  // Try screenshot_preview_links
  if (Array.isArray(doc.screenshot_preview_links) && doc.screenshot_preview_links.length > 0) {
    return doc.screenshot_preview_links.filter(s => typeof s === "string" && s.trim());
  }
  
  // Try screenshot_links
  if (Array.isArray(doc.screenshot_links) && doc.screenshot_links.length > 0) {
    return doc.screenshot_links.filter(s => typeof s === "string" && s.trim());
  }
  
  return [];
};

const findBestMatch = (movieTitle, screenshotDocs) => {
  if (!movieTitle || !screenshotDocs || screenshotDocs.length === 0) return null;
  
  const normalizedTitle = normalizeKey(movieTitle);
  if (!normalizedTitle) return null;
  
  const titleWords = normalizedTitle.split(" ").filter(w => w.length > 2);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const doc of screenshotDocs) {
    const docKey = normalizeKey(doc.movie_key || doc.title || "");
    if (!docKey) continue;
    
    // Exact match
    if (docKey === normalizedTitle) {
      return extractScreenshotLinks(doc);
    }
    
    // Substring match
    if (normalizedTitle.includes(docKey) || docKey.includes(normalizedTitle)) {
      return extractScreenshotLinks(doc);
    }
    
    // Word-based matching
    const docWords = docKey.split(" ").filter(w => w.length > 2);
    const matchingWords = titleWords.filter(tw => 
      docWords.some(dw => dw.includes(tw) || tw.includes(dw))
    );
    
    const score = matchingWords.length;
    const minRequiredMatch = Math.max(2, Math.floor(titleWords.length * 0.4));
    
    if (score >= minRequiredMatch && score > bestScore) {
      bestScore = score;
      bestMatch = extractScreenshotLinks(doc);
    }
  }
  
  return bestMatch;
};

export const handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  try {
    const connection = await connect();
    const db = connection.db;
    
    // Fetch all movies
    const movies = await Movie.find()
      .sort({ createdAt: -1 })
      .lean();

    // Try to fetch screenshot documents from multiple possible collections
    let screenshotDocs = [];
    const possibleCollections = ["movie_screenshots", "telegram_files", "movie_files", "downloads"];
    
    for (const collName of possibleCollections) {
      try {
        const collections = await db.listCollections({}, { nameOnly: true }).toArray();
        const collExists = collections.some(c => c.name === collName);
        
        if (collExists) {
          const docs = await db.collection(collName).find({
            $or: [
              { screenshots: { $exists: true, $ne: [] } },
              { screenshot_preview_links: { $exists: true, $ne: [] } },
              { screenshot_links: { $exists: true, $ne: [] } }
            ]
          }).toArray();
          
          if (docs.length > 0) {
            screenshotDocs = docs;
            console.log(`Found ${docs.length} screenshot documents in collection: ${collName}`);
            break;
          }
        }
      } catch (err) {
        console.warn(`Error checking collection ${collName}:`, err.message);
      }
    }

    // Enrich movies with screenshots
    const enrichedMovies = movies.map((movie) => {
      // Check if movie already has screenshots
      const existing = extractScreenshotLinks(movie);
      if (existing.length > 0) {
        return {
          ...movie,
          screenshots: existing,
          screenshot_links: existing,
          screenshot_preview_links: existing,
        };
      }

      // Try to find matching screenshots
      const matched = findBestMatch(movie.title, screenshotDocs);
      if (matched && matched.length > 0) {
        return {
          ...movie,
          screenshots: matched,
          screenshot_links: matched,
          screenshot_preview_links: matched,
        };
      }

      return movie;
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
