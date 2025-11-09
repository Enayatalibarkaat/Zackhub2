exports.handler = async (event) => {
  try {
    const method = event.httpMethod;

    if (method === "GET") {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "GET request working ✅" })
      };
    }

    if (method === "POST") {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "POST request working ✅" })
      };
    }

    if (method === "DELETE") {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "DELETE request working ✅" })
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed ❌" })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Error", details: err.message })
    };
  }
};
