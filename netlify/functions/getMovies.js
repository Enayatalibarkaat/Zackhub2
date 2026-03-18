import { connect } from "./connect.js";
import Movie from "./moviesSchema.js";

const normalizeKey = (value = "") =>
  value
    .toLowerCase()
    .replace(/\.(mkv|mp4|avi|mov)$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeScreenshotEntries = (raw = []) => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";

      return (
        item.url ||
        item.link ||
        item.href ||
        item.preview ||
        item.preview_link ||
        item.previewLink ||
        ""
      );
    })
    .filter(Boolean);
};

const extractScreenshotLinks = (doc = {}) => {
  const screenshots = normalizeScreenshotEntries(doc.screenshots || []);
  if (screenshots.length) return screenshots;

  const previewLinks = normalizeScreenshotEntries(doc.screenshot_preview_links || doc.screenshotPreviewLinks || []);
  if (previewLinks.length) return previewLinks;

  const rawLinks = normalizeScreenshotEntries(doc.screenshot_links || doc.screenshotLinks || []);
  if (!rawLinks.length) return [];

  return rawLinks.map((link) => (typeof link === "string" ? link.replace('/dl/', '/view/') : link));
};

const fetchScreenshotsFromFileToStream = async (movieTitle) => {
  try {
    const movieKey = normalizeKey(movieTitle);
    if (!movieKey) return null;

    const response = await fetch(
      `https://file-to-stream-m1.onrender.com/screenshots/${encodeURIComponent(movieKey)}`,
      { timeout: 5000 }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const screenshots = normalizeScreenshotEntries(data.screenshots || []);
    
    if (screenshots.length > 0) {
      return screenshots;
    }

    return null;
  } catch (error) {
    console.warn(`Screenshot fetch failed for "${movieTitle}":`, error?.message);
    return null;
  }
};

const collectScreenshotMap = async (db) => {
  const configured = (process.env.SCREENSHOT_COLLECTIONS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const fallbackCollections = ["movie_screenshots", "telegram_files", "movie_files", "downloads", "links", "files"];
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
            { screenshots: { $exists: true, $ne: [] } },
            { screenshot_preview_links: { $exists: true, $ne: [] } },
            { screenshot_links: { $exists: true, $ne: [] } },
            { screenshotLinks: { $exists: true, $ne: [] } },
          ],
        },
        {
          projection: {
            movie_key: 1,
            title: 1,
            _id: 1,
            screenshots: 1,
            screenshot_preview_links: 1,
            screenshot_links: 1,
            screenshotLinks: 1,
          },
        }
      )
      .toArray();

    for (const doc of docs) {
      const links = extractScreenshotLinks(doc);
      if (!links.length) continue;

      const possibleKeys = [
        doc.movie_key, 
        doc.title, 
        typeof doc._id === "string" ? doc._id : doc._id?.toString?.() || ""
      ];
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
    
    const movies = await Movie.find()
      .sort({ createdAt: -1 })
      .lean();

    let screenshotMap = new Map();
    try {
      screenshotMap = await collectScreenshotMap(db);
    } catch (lookupError) {
      console.warn("Screenshot lookup skipped:", lookupError?.message || lookupError);
    }

    const enrichedMovies = await Promise.all(
      movies.map(async (movie) => {
        // Check if movie already has screenshots
        const existing = extractScreenshotLinks(movie);
        if (existing.length) {
          return {
            ...movie,
            screenshots: existing,
            screenshot_links: existing,
            screenshot_preview_links: existing,
          };
        }

        // Try to fetch from file-to-stream-m1 API
        const fileToStreamScreenshots = await fetchScreenshotsFromFileToStream(movie.title);
        if (fileToStreamScreenshots && fileToStreamScreenshots.length > 0) {
          return {
            ...movie,
            screenshots: fileToStreamScreenshots,
            screenshot_links: fileToStreamScreenshots,
            screenshot_preview_links: fileToStreamScreenshots,
          };
        }

        // Fallback to local screenshot map
        const titleKey = normalizeKey(movie?.title || "");
        const movieIdStr = movie?._id?.toString?.() || movie?._id || "";
        
        if (titleKey && screenshotMap.has(titleKey)) {
          const matched = screenshotMap.get(titleKey);
          return {
            ...movie,
            screenshots: matched,
            screenshot_links: matched,
            screenshot_preview_links: matched,
          };
        }

        if (movieIdStr && screenshotMap.has(movieIdStr)) {
          const matched = screenshotMap.get(movieIdStr);
          return {
            ...movie,
            screenshots: matched,
            screenshot_links: matched,
            screenshot_preview_links: matched,
          };
        }

        return movie;
      })
    );

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
