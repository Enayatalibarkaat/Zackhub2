import { connect } from "./connect.js";
import Movie from "./moviesSchema.js";

const normalizeKey = (value = "") =>
  value
    .toLowerCase()
    .replace(/\.(mkv|mp4|avi|mov)$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const extractScreenshotLinks = (doc = {}) => {
  const raw = doc.screenshot_links || doc.screenshotLinks || [];
  return Array.isArray(raw) ? raw.filter(Boolean) : [];
};

const findBestScreenshotMatch = (movie, screenshotMap) => {
  const titleKey = normalizeKey(movie?.title || "");
  if (!titleKey) return null;

  if (screenshotMap.has(titleKey)) return screenshotMap.get(titleKey);

  const titleTokens = titleKey.split(" ").filter(Boolean);
  for (const [key, links] of screenshotMap.entries()) {
    if (!key || !links?.length) continue;
    if (key.includes(titleKey) || titleKey.includes(key)) return links;

    const tokenMatchCount = titleTokens.filter((t) => key.includes(t)).length;
    if (tokenMatchCount >= Math.max(2, Math.floor(titleTokens.length * 0.6))) {
      return links;
    }
  }

  return null;
};

const collectScreenshotMap = async (db) => {
  const configured = (process.env.SCREENSHOT_COLLECTIONS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const fallbackCollections = ["telegram_files", "movie_files", "downloads", "links", "files"];
  const collectionNames = configured.length ? configured : fallbackCollections;

  const existingCollections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name)
  );

  const screenshotMap = new Map();

  for (const name of collectionNames) {
    if (!existingCollections.has(name)) continue;

    const docs = await db
      .collection(name)
      .find(
        {
          $or: [
            { screenshot_links: { $exists: true, $ne: [] } },
            { screenshotLinks: { $exists: true, $ne: [] } },
          ],
        },
        {
          projection: {
            movie_key: 1,
            title: 1,
            _id: 1,
            screenshot_links: 1,
            screenshotLinks: 1,
          },
        }
      )
      .toArray();

    for (const doc of docs) {
      const links = extractScreenshotLinks(doc);
      if (!links.length) continue;

      const possibleKeys = [doc.movie_key, doc.title, typeof doc._id === "string" ? doc._id : ""];
      for (const key of possibleKeys) {
        const normalized = normalizeKey(key || "");
        if (!normalized || screenshotMap.has(normalized)) continue;
        screenshotMap.set(normalized, links);
      }
    }
  }

  return screenshotMap;
};

export const handler = async (event, context) => {
  // --- SMART CACHING HEADERS ---
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    // s-maxage=60: 60 second tak data super fast load hoga (Cache se).
    // stale-while-revalidate=600: Agar 60 sec se purana data hai, to user ko wahi dikhao 
    // lekin background me chupke se naya data update kar lo.
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600"
  };

  // Handle Preflight requests
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  try {
    const connection = await connect();
    const db = connection.db;
    
    // Data fetch query
    const movies = await Movie.find()
      .sort({ createdAt: -1 })
      .lean(); // .lean() makes it faster

    let screenshotMap = new Map();
    try {
      screenshotMap = await collectScreenshotMap(db);
    } catch (lookupError) {
      console.warn("Screenshot lookup skipped:", lookupError?.message || lookupError);
    }

    const enrichedMovies = movies.map((movie) => {
      const existing = extractScreenshotLinks(movie);
      if (existing.length) return movie;

      const matched = findBestScreenshotMatch(movie, screenshotMap);
      if (!matched?.length) return movie;

      return {
        ...movie,
        screenshot_links: matched,
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
