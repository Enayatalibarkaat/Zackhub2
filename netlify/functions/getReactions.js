const { MongoClient } = require('mongodb');

const uri = process.env.COMMENTS_MONGODB_URI;
const dbName = "zackhub";
const collectionName = "comments";  

let clientPromise = null;
async function getClient() {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
  return clientPromise;
}

exports.handler = async (event) => {
  try {
    const movieId = event.queryStringParameters.movieId;

    if (!movieId) {
      return { statusCode: 400, body: "movieId required" };
    }

    const client = await getClient();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    const doc = await col.findOne({ movieId });

    if (!doc || !doc.reactions) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          love: 0,
          haha: 0,
          wow: 0,
          sad: 0,
          angry: 0,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(doc.reactions),
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "internal error" };
  }
};
