const { MongoClient } = require('mongodb');

const uri = process.env.COMMENTS_MONGODB_URI;
const dbName = "zackhub";
const collectionName = "comments";  // yahi pe reactions bhi save honge

let clientPromise = null;
async function getClient() {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  }
  return clientPromise;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "POST required" };
  }

  try {
    const body = JSON.parse(event.body);

    const { movieId, reaction } = body;

    if (!movieId || !reaction) {
      return { statusCode: 400, body: "movieId & reaction required" };
    }

    const client = await getClient();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    // movie document find karo
    let doc = await col.findOne({ movieId });

    // agar nahi mila to create karo
    if (!doc) {
      doc = {
        movieId,
        comments: [],
        reactions: {
          love: 0,
          haha: 0,
          wow: 0,
          sad: 0,
          angry: 0
        }
      };
      await col.insertOne(doc);
    }

    // reaction count +1
    await col.updateOne(
      { movieId },
      { $inc: { [`reactions.${reaction}`]: 1 } }
    );

    // updated counts wapis do
    const updated = await col.findOne({ movieId });

    return {
      statusCode: 200,
      body: JSON.stringify(updated.reactions),
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Internal error" };
  }
};
