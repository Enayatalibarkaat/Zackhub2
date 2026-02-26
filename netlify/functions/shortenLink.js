import { connect } from "./connect.js";
import Settings from "./settingsSchema.js";

const SETTINGS_KEY = "telegram_settings";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const safeTrim = (value) => (typeof value === "string" ? value.trim() : "");

const getByPath = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), obj);
};

const parsePaths = (raw) => {
  const defaultPaths = [
    "shortenedUrl",
    "shortened_url",
    "short",
    "url",
    "result.shortenedUrl",
    "result.shortened_url",
    "result.url",
    "data.shortenedUrl",
    "data.url",
  ];
  if (!raw || typeof raw !== "string") return defaultPaths;
  const paths = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return paths.length ? paths : defaultPaths;
};

const pickShortenedUrl = (result, responsePaths) => {
  for (const path of responsePaths) {
    const value = getByPath(result, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const buildRequest = ({ apiUrl, httpMethod, payloadType, apiKeyField, urlField, apiKey, urlToShorten }) => {
  const method = httpMethod === "POST" ? "POST" : "GET";
  const payload = {
    [apiKeyField]: apiKey,
    [urlField]: urlToShorten,
  };

  if (method === "GET" || payloadType === "query") {
    const u = new URL(apiUrl);
    Object.entries(payload).forEach(([k, v]) => u.searchParams.set(k, v));
    return { url: u.toString(), options: { method: "GET" } };
  }

  if (payloadType === "form") {
    const body = new URLSearchParams(payload).toString();
    return {
      url: apiUrl,
      options: {
        method,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    };
  }

  return {
    url: apiUrl,
    options: {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  };
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
    const httpMethod = safeTrim(settings.linkShortenerHttpMethod).toUpperCase() || "GET";
    const payloadType = safeTrim(settings.linkShortenerPayloadType).toLowerCase() || "query";
    const apiKeyField = safeTrim(settings.linkShortenerApiKeyField) || "api";
    const urlField = safeTrim(settings.linkShortenerUrlField) || "url";
    const responsePaths = parsePaths(settings.linkShortenerResponsePaths);

    if (!apiUrl || !apiKey) {
      return { statusCode: 200, headers, body: JSON.stringify({ shortenedUrl: urlToShorten, bypassed: true }) };
    }

    let request;
    try {
      request = buildRequest({
        apiUrl,
        httpMethod,
        payloadType,
        apiKeyField,
        urlField,
        apiKey,
        urlToShorten,
      });
    } catch (e) {
      console.error("Invalid shortener URL/config:", e);
      return { statusCode: 200, headers, body: JSON.stringify({ shortenedUrl: urlToShorten, bypassed: true }) };
    }

    const response = await fetch(request.url, request.options);

    let result = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }

    const shortenedUrl = pickShortenedUrl(result, responsePaths);

    if (!response.ok || !shortenedUrl) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ shortenedUrl: urlToShorten, bypassed: true, providerError: !response.ok }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ shortenedUrl }),
    };
  } catch (error) {
    console.error("shortenLink handler error:", error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ shortenedUrl: urlToShorten, bypassed: true }),
    };
  }
};
