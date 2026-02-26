import { connect } from "./connect.js";
import Settings from "./settingsSchema.js";

const SETTINGS_KEY = "telegram_settings";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const safeTrim = (value) => (typeof value === "string" ? value.trim() : "");

const extractShortUrl = (result) => {
  const paths = [
    "shortenedUrl",
    "shortened_url",
    "short",
    "url",
    "result.url",
    "result.shortenedUrl",
    "result.shortened_url",
    "data.url",
    "data.shortenedUrl",
    "data.shortened_url",
  ];

  const getByPath = (obj, path) => path.split(".").reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), obj);

  for (const path of paths) {
    const value = getByPath(result, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const tryProvider = async ({ apiUrl, apiKey, targetUrl }) => {
  const queryUrl = new URL(apiUrl);
  queryUrl.searchParams.set("api", apiKey);
  queryUrl.searchParams.set("url", targetUrl);

  const attempts = [
    { url: queryUrl.toString(), options: { method: "GET" } },
    {
      url: apiUrl,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api: apiKey, url: targetUrl }),
      },
    },
    {
      url: apiUrl,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ api: apiKey, url: targetUrl }).toString(),
      },
    },
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, attempt.options);
      const result = await response.json().catch(() => ({}));
      const shortenedUrl = extractShortUrl(result);
      if (response.ok && shortenedUrl) {
        return shortenedUrl;
      }
    } catch (error) {
      console.error("shortener attempt failed:", error);
    }
  }

  return "";
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let urlToShorten = "";

  try {
    const body = JSON.parse(event.body || "{}");
    urlToShorten = safeTrim(body.url);

    if (!urlToShorten) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "URL is required" }) };
    }

    await connect();
    const settings = await Settings.findOne({ key: SETTINGS_KEY });

    if (!settings || !settings.linkShortenerEnabled) {
      return { statusCode: 200, headers, body: JSON.stringify({ shortenedUrl: urlToShorten, bypassed: true }) };
    }

    const apiUrl = safeTrim(settings.linkShortenerApiUrl);
    const apiKey = safeTrim(settings.linkShortenerApiKey);

    if (!apiUrl || !apiKey) {
      return { statusCode: 200, headers, body: JSON.stringify({ shortenedUrl: urlToShorten, bypassed: true }) };
    }

    const shortenedUrl = await tryProvider({ apiUrl, apiKey, targetUrl: urlToShorten });

    if (!shortenedUrl) {
      return { statusCode: 200, headers, body: JSON.stringify({ shortenedUrl: urlToShorten, bypassed: true, providerError: true }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ shortenedUrl }) };
  } catch (error) {
    console.error("shortenLink handler error:", error);
    return { statusCode: 200, headers, body: JSON.stringify({ shortenedUrl: urlToShorten, bypassed: true }) };
  }
};
