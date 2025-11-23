import { connect } from "./connect.js";
import Visit from "./visitSchema.js";

export const handler = async () => {
  try {
    await connect();

    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 1. Aaj ke Unique Visitors
    const todayVisits = await Visit.countDocuments({
      visitedAt: { $gte: startOfDay }
    });

    // 2. Total Visitors (Last 30 Days - Kyunki purane to delete ho gaye honge)
    const totalVisits = await Visit.countDocuments();

    // 3. Graph Data (Last 7 Days) - Optional lekin accha lagta hai
    // Ye thoda complex aggregation hai, abhi simple rakhte hain.

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache" // Admin data hamesha fresh chahiye
      },
      body: JSON.stringify({
        today: todayVisits,
        total: totalVisits
      }),
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Stats Error" }) };
  }
};
