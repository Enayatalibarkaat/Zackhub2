import { connect } from "./connect.js";
import Visit from "./visitSchema.js";

export const handler = async (event) => {
  // Sirf POST request allow karenge
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    await connect();

    // User ka IP Address nikalna (Netlify headers se)
    const ip = event.headers["client-ip"] || event.headers["x-forwarded-for"] || "unknown";
    
    // Check: Kya is IP ne aaj visit kiya hai?
    // (Hum chahte hain ki ek banda din me 100 baar aaye to bhi 1 hi count ho - Unique Daily)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const existingVisit = await Visit.findOne({
      ip: ip,
      visitedAt: { $gte: startOfDay }
    });

    if (!existingVisit) {
      // Agar aaj pehli baar aaya hai, to save karo
      await Visit.create({ ip });
    }

    return { statusCode: 200, body: "Tracked" };

  } catch (error) {
    console.error("Tracking Error:", error);
    return { statusCode: 500, body: "Error" };
  }
};
