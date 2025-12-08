// migrateThreads.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Thread from "./models/Thread.js";

dotenv.config(); // load .env so MONGODB_URI works

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Mark all old threads as orphaned (owner: null)
    const result = await Thread.updateMany(
      { owner: { $exists: false } },
      { $set: { owner: null } }
    );

    console.log("Migration complete:");
    console.log(result);

    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

run();
// migrateThreads.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Thread from "./models/Thread.js";

dotenv.config(); // load .env so MONGODB_URI works

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI (or MONGO_URI) not set in environment.");
      process.exit(1);
    }

    await mongoose.connect(mongoUri, {
      // keep defaults; add options if required by your Mongo version
      // useUnifiedTopology and useNewUrlParser are default in modern mongoose
    });

    console.log("Connected to MongoDB");

    // Mark all old threads that do not have 'owner' set as orphaned (owner: null)
    const result = await Thread.updateMany(
      { owner: { $exists: false } },
      { $set: { owner: null } }
    );

    console.log("Migration complete. Updated documents:", result.modifiedCount ?? result.nModified ?? result);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    try { await mongoose.disconnect(); } catch(e) {}
    process.exit(1);
  }
}

run();
