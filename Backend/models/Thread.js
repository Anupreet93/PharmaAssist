// models/Thread.js
import mongoose from "mongoose";

/* -------------------------------------------------
   Message schema (ChatGPT-style messages)
------------------------------------------------- */
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

/* -------------------------------------------------
   Search metadata (structured history)
------------------------------------------------- */
const SearchMetaSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true
    },
    params: {
      type: Object,
      default: {} // filters, pagination, etc.
    },
    resultsSummary: {
      type: String,
      default: null
    },
    resultsCount: {
      type: Number,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

/* -------------------------------------------------
   Thread schema
------------------------------------------------- */
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

    // Stores structured search history (medicine, generics, etc.)
    searches: {
      type: [SearchMetaSchema],
      default: []
    }
  },
  {
    timestamps: true // createdAt, updatedAt
  }
);

/* -------------------------------------------------
   Indexes for performance
------------------------------------------------- */
ThreadSchema.index({ owner: 1, threadId: 1 }, { unique: true, sparse: true });
ThreadSchema.index({ owner: 1, updatedAt: -1 });

export default mongoose.model("Thread", ThreadSchema);
