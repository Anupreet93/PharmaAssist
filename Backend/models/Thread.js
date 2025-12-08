// models/Thread.js
import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const SearchMetaSchema = new mongoose.Schema(
  {
    query: { type: String, required: true },
    params: { type: Object, default: {} }, // e.g. filters, page, etc.
    resultsSummary: { type: String, default: null }, // optional short summary
    resultsCount: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ThreadSchema = new mongoose.Schema(
  {
    threadId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
      default: null
    },

    title: {
      type: String,
      default: "New Chat"
    },
    messages: {
      type: [MessageSchema],
      default: []
    },

    // NEW: keep historical search metadata for this thread
    searches: {
      type: [SearchMetaSchema],
      default: []
    }
  },
  {
    timestamps: true // createdAt, updatedAt
  }
);

// compound index to speed lookups by owner + threadId
ThreadSchema.index({ owner: 1, threadId: 1 }, { unique: true, sparse: true });
ThreadSchema.index({ owner: 1, updatedAt: -1 });

export default mongoose.model("Thread", ThreadSchema);
