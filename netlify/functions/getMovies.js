import { connect } from "./connect.js";
import Movie from "./moviesSchema.js";

// Same pattern as the bot uses
const STRIP_TOKENS_PATTERN = /\b(2160p|1440p|1080p|720p|480p|360p|240p|x264|x265|hevc|hdrip|webrip|web[- ]?dl|bluray|dvdrip|10bit|8bit|esubs|dual[- ]?audio|amzn|nf|hindi|english|tamil|telugu|malayalam)\b/gi;

const normalizeMovieKey = (value = "") => {
  if (!value) return "";
  
  // Same logic as bot's extract_movie_key function
  let source = value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\./g, " ");
  
  // Remove quality tokens
  source = source.replace(STRIP_TOKENS_PATTERN, " ");
  
  // Remove resolution patterns
  source = source.replace(/\b\d{3,4}p\b/g, " ");
  
  // Normalize spaces
  source = source.replace(/\s+/g, " ").trim();
  
  return source.substring(0, 120) || "unknown_movie";
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

const findScreenshotsForMovie = (movieTitle, screenshotDocs) => {
  if (!movieTitle || !screenshotDocs || screenshotDocs.length === 0) return null;
  
  // Normalize the movie title using the same logic as the bot
  const normalizedTitle = normalizeMovieKey(movieTitle);
  if (!normalizedTitle) return null;
  
  console.log(`Looking for screenshots for: "${movieTitle}" -> "${normalizedTitle}"`);
  
  // Try to find exact match or close match
  for (const doc of screenshotDocs) {
    const docKey = doc.movie_key || doc._id || "";
    const normalizedDocKey = normalizeMovieKey(docKey);
    
    if (!normalizedDocKey) continue;
    
    console.log(`Comparing with: "${docKey}" -> "${normalizedDocKey}"`);
    
    // Exact match
    if (normalizedTitle === normalizedDocKey) {
      console.log(`✓ EXACT MATCH FOUND!`);
      return extractScreenshotLinks(doc);
    }
    
    // Substring match
    if (normalizedTitle.includes(normalizedDocKey) || normalizedDocKey.includes(normalizedTitle)) {
      console.log(`✓ SUBSTRING MATCH FOUND!`);
      return extractScreenshotLinks(doc);
    }
  }
  
  console.log(`✗ No match found for: "${normalizedTitle}"`);
  return null;
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
    
    // Fetch all movies from moviesdb
    const movies = await Movie.find()
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Fetched ${movies.length} movies from moviesdb`);

    // Fetch all screenshot documents from movie_screenshots collection
    let screenshotDocs = [];
    try {
      const collections = await db.listCollections({}, { nameOnly: true }).toArray();
      const hasScreenshotCollection = collections.some(c => c.name === "movie_screenshots");
      
      if (hasScreenshotCollection) {
        screenshotDocs = await db.collection("movie_screenshots").find({}).toArray();
        console.log(`Fetched ${screenshotDocs.length} screenshot documents from movie_screenshots collection`);
      }
    } catch (err) {
      console.warn("Error fetching screenshot collection:", err.message);
    }

    // Enrich movies with screenshots
    const enrichedMovies = movies.map((movie) => {
      // Check if movie already has screenshots in moviesdb
      const existing = extractScreenshotLinks(movie);
      if (existing.length > 0) {
        console.log(`Movie "${movie.title}" already has ${existing.length} screenshots in moviesdb`);
        return {
          ...movie,
          screenshots: existing,
          screenshot_links: existing,
          screenshot_preview_links: existing,
        };
      }

      // Try to find matching screenshots from movie_screenshots collection
      const matched = findScreenshotsForMovie(movie.title, screenshotDocs);
      if (matched && matched.length > 0) {
        console.log(`✓ Found ${matched.length} screenshots for "${movie.title}"`);
        return {
          ...movie,
          screenshots: matched,
          screenshot_links: matched,
          screenshot_preview_links: matched,
        };
      }

      console.log(`✗ No screenshots found for "${movie.title}"`);
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
