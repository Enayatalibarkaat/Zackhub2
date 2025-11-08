export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { username, password } = JSON.parse(event.body || "{}");

  // Super admin username and password from Netlify environment variables
  const SUPER_USER = process.env.SUPER_USER;
  const SUPER_PW = process.env.SUPER_PW;

  if (!SUPER_USER || !SUPER_PW) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server login config not set" }),
    };
  }

  // Match user credentials
  if (username === SUPER_USER && password === SUPER_PW) {
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Login successful" }),
    };
  } else {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Invalid credentials" }),
    };
  }
};
