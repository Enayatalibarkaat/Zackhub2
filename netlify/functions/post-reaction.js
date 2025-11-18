const { MongoClient } = require('mongodb');

let client = null;

async function getClient() {
  if (!client) {
    client = new MongoClient(process.env.COMMENTS_MONGODB_URI);
    await client.connect();
  }
  return client;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body);
    const { movieId, userId, reaction } = body;

    const mongo = await getClient();
    const db = mongo.db("zackhub");
    const col = db.collection("reactions");

    const defaultCounts = {
      love: 0, haha: 0, wow: 0, sad: 0, angry: 0
    };

    const doc = await col.findOne({ movieId });

    const prev = doc?.userReactions?.[userId] || null;

    const inc = {};
    if (prev) inc[`counts.${prev}`] = -1;
    if (reaction) inc[`counts.${reaction}`] = 1;

    const update = {
      $inc: inc,
      $setOnInsert: {
        counts: defaultCounts,
        userReactions: {},
        movieId
      }
    };

    if (reaction) {
      update.$set = { [`userReactions.${userId}`]: reaction };
    } else {
      update.$unset = { [`userReactions.${userId}`]: "" };
    }

    const result = await col.findOneAndUpdate(
      { movieId },
      update,
      { upsert: true, returnDocument: "after" }
    );

    const finalDoc = result.value;

    // sanitize negative counts
    Object.keys(finalDoc.counts).forEach(k => {
      if (finalDoc.counts[k] < 0) finalDoc.counts[k] = 0;
    });

    await col.updateOne(
      { movieId },
      { $set: { counts: finalDoc.counts } }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ counts: finalDoc.counts })
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Server Error" };
  }
};
