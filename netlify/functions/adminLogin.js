// netlify/functions/adminLogin.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const { username = "", password = "" } = body;

    // Credentials from Netlify environment variables
    const SUPER_USER = process.env.SUPER_ADMIN_USERNAME || "";
    const SUPER_PW   = process.env.SUPER_ADMIN_PASSWORD || "";

    if (!SUPER_USER || !SUPER_PW) {
      console.error("Super admin env vars missing");
      return { statusCode: 500, body: JSON.stringify({ error: "Server not configured" }) };
    }

    if (username === SUPER_USER && password === SUPER_PW) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, user: { username: SUPER_USER, role: "super" } }),
      };
    }

    return { statusCode: 401, body: JSON.stringify({ success: false, error: "Invalid credentials" }) };

  } catch (err) {
    console.error("adminLogin error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
