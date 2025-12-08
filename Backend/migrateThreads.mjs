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
