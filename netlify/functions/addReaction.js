const { MongoClient } = require("mongodb");

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
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "POST required" };
  }

  try {
    const body = JSON.parse(event.body);

    const movieId = String(body.movieId);
    const reaction = body.reaction;
    const previous = body.previousReaction;

    if (!movieId || !reaction) {
      return { statusCode: 400, body: "movieId & reaction required" };
    }

    const client = await getClient();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    // Document exists ya create
    let doc = await col.findOne({ movieId });
    if (!doc) {
      doc = {
        movieId,
        comments: [],
        reactions: {
          love: 0,
          haha: 0,
          wow: 0,
          sad: 0,
          angry: 0,
        },
      };
      await col.insertOne(doc);
    }

    // INC Object
    let change = {};

    // Agar same reaction pe dobara click kiya → -1
    if (previous === reaction) {
      change[`reactions.${reaction}`] = -1;
    } else {
      // New reaction → +1
      change[`reactions.${reaction}`] = 1;

      // Purani reaction hatani hai → -1
      if (previous) {
        change[`reactions.${previous}`] = -1;
      }
    }

    await col.updateOne({ movieId }, { $inc: change });

    // Final updated data
    const updated = await col.findOne({ movieId });

    // Negative values fix
    const safe = { ...updated.reactions };
    let fixNeeded = false;
    for (let key in safe) {
      if (safe[key] < 0) {
        safe[key] = 0;
        fixNeeded = true;
      }
    }

    if (fixNeeded) {
      await col.updateOne({ movieId }, { $set: { reactions: safe } });
      return { statusCode: 200, body: JSON.stringify(safe) };
    }

    return { statusCode: 200, body: JSON.stringify(updated.reactions) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "internal error" };
  }
};
