import { MongoClient, ObjectId } from "mongodb";

// हम वही URI यूज़ कर रहे हैं जो आपने Comments के लिए सेट किया है
const mongoClient = new MongoClient(process.env.COMMENTS_MONGODB_URI);
const clientPromise = mongoClient.connect();

export const handler = async (event, context) => {
  try {
    const database = (await clientPromise).db();
    // हम 'requests' नाम की एक नई कलेक्शन (table) बना रहे हैं उसी DB में
    const collection = database.collection("requests");

    // 1. जब यूजर रिक्वेस्ट भेजेगा (POST Request)
    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body);
      
      if (!data.title) {
        return { statusCode: 400, body: JSON.stringify({ message: "Title is required" }) };
      }

      const newRequest = {
        title: data.title,
        createdAt: new Date(),
        status: "pending" // अभी पेंडिंग है
      };

      await collection.insertOne(newRequest);
      return { statusCode: 200, body: JSON.stringify({ success: true, message: "Request saved" }) };
    }

    // 2. जब एडमिन रिक्वेस्ट देखेगा (GET Request)
    if (event.httpMethod === "GET") {
      // सारी रिक्वेस्ट लाओ, नई वाली सबसे ऊपर
      const requests = await collection.find({}).sort({ createdAt: -1 }).limit(100).toArray();
      return { statusCode: 200, body: JSON.stringify({ requests }) };
    }

    // 3. जब एडमिन रिक्वेस्ट स्टेटस अपडेट करेगा (PATCH Request)
    if (event.httpMethod === "PATCH") {
      const data = JSON.parse(event.body || "{}");
      const { id, status } = data;

      if (!id || !status) {
        return { statusCode: 400, body: JSON.stringify({ message: "id and status are required" }) };
      }

      const normalizedStatus = String(status).toLowerCase();
      const allowedStatuses = ["pending", "completed", "rejected"];
      if (!allowedStatuses.includes(normalizedStatus)) {
        return { statusCode: 400, body: JSON.stringify({ message: "Invalid status value" }) };
      }

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: normalizedStatus, updatedAt: new Date() } }
      );

      if (result.matchedCount === 0) {
        return { statusCode: 404, body: JSON.stringify({ message: "Request not found" }) };
      }

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: "Method Not Allowed" };

  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
