const { MongoClient } = require("mongodb");

const uri = process.env.COMMENTS_MONGODB_URI;
const dbName = "zackhub";
const collectionName = "comments"; // reactions bhi yahi me save honge

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

    // ensure movieId is string
    const movieId = String(body.movieId);
    const reaction = body.reaction;
    const previousReaction = body.previousReaction;

    if (!movieId || !reaction) {
      return {
        statusCode: 400,
        body: "movieId & reaction required",
      };
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
          angry: 0,
        },
      };
      await col.insertOne(doc);
    }

    // ----------------------------------------
    // MAIN LOGIC: SAME / CHANGE REACTION
    // ----------------------------------------

    // Agar same reaction dobara dabaya → count -1
    if (previousReaction === reaction) {
      await col.updateOne(
        { movieId },
        { $inc: { [`reactions.${reaction}`]: -1 } }
      );

      const updatedSame = await col.findOne({ movieId });
      return {
        statusCode: 200,
        body: JSON.stringify(updatedSame.reactions),
      };
    }

    // Agar user naya reaction choose kare:
    // New reaction +1 & previous -1 (agar previous exist karta hai)
    let incObj = { [`reactions.${reaction}`]: 1 };

    if (previousReaction && previousReaction !== reaction) {
      incObj[`reactions.${previousReaction}`] = -1;
    }

    await col.updateOne({ movieId }, { $inc: incObj });

    // Final updated doc
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
