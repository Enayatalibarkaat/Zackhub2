import { connect } from "./connect.js";
import Movie from "./moviesSchema.js";
import Settings from "./settingsSchema.js";

const SETTINGS_KEY = "telegram_settings";

const getDefaultSettings = () => ({
  key: SETTINGS_KEY,
  enableTelegramForNewMovies: false,
  enableTelegramGlobally: true,
});

const getSettingsDoc = async () => {
  let settings = await Settings.findOne({ key: SETTINGS_KEY });
  if (!settings) {
    settings = await Settings.create(getDefaultSettings());
  }
  return settings;
};

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  try {
    await connect();

    if (event.httpMethod === "GET") {
      const settings = await getSettingsDoc();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          settings: {
            enableTelegramForNewMovies: !!settings.enableTelegramForNewMovies,
            enableTelegramGlobally: !!settings.enableTelegramGlobally,
          },
        }),
      };
    }

    if (event.httpMethod === "PATCH") {
      const data = JSON.parse(event.body || "{}");
      const updates = {};

      if (typeof data.enableTelegramForNewMovies === "boolean") {
        updates.enableTelegramForNewMovies = data.enableTelegramForNewMovies;
      }

      if (typeof data.enableTelegramGlobally === "boolean") {
        updates.enableTelegramGlobally = data.enableTelegramGlobally;
        await Movie.updateMany({}, { $set: { showTelegramFiles: data.enableTelegramGlobally } });
      }

      const settings = await Settings.findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $set: updates, $setOnInsert: getDefaultSettings() },
        { new: true, upsert: true }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          settings: {
            enableTelegramForNewMovies: !!settings.enableTelegramForNewMovies,
            enableTelegramGlobally: !!settings.enableTelegramGlobally,
          },
        }),
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  } catch (error) {
    console.error("Telegram settings handler error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: "Failed to manage telegram settings" }),
    };
  }
};
