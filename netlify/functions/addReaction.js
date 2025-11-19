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
    const previous = body.previousReaction || null;  // <- IMPORTANT FIX

    if (!movieId || !reaction) {
      return { statusCode: 400, body: "movieId & reaction required" };
    }

    const client = await getClient();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

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

    let change = {};

    // SAME REACTION again -> REMOVE IT
    if (previous === reaction) {
      change[`reactions.${reaction}`] = -1;
    } 
    
    // NEW reaction
    else {
      // new reaction +1
      change[`reactions.${reaction}`] = 1;

      // old reaction -1 (if exists)
      if (previous) {
        change[`reactions.${previous}`] = -1;
      }
    }

    await col.updateOne({ movieId }, { $inc: change });

    // get updated
    const updated = await col.findOne({ movieId });

    // never allow negative values
    const safe = { ...updated.reactions };
    let needFix = false;
    for (let k in safe) {
      if (safe[k] < 0) {
        safe[k] = 0;
        needFix = true;
      }
    }

    if (needFix) {
      await col.updateOne({ movieId }, { $set: { reactions: safe } });
      return {
        statusCode: 200,
        body: JSON.stringify(safe),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(updated.reactions),
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "internal error" };
  }
};
