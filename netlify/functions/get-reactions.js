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
    const { movieId, userId } = event.queryStringParameters;

    const mongo = await getClient();
    const db = mongo.db("zackhub");
    const col = db.collection("reactions");

    const doc = await col.findOne({ movieId });

    const defaultCounts = {
      love: 0, haha: 0, wow: 0, sad: 0, angry: 0
    };

    if (!doc) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          counts: defaultCounts,
          userReaction: null
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        counts: doc.counts || defaultCounts,
        userReaction: doc.userReactions?.[userId] || null
      })
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Server Error" };
  }
};
