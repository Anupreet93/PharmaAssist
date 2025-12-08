// controllers/searchController.js
import Thread from "../models/Thread.js";
import { v4 as uuidv4 } from "uuid"; // or use crypto.randomUUID() in Node 20+

/**
 * POST /api/search
 * body: { threadId?: string, query: string, params?: {}, resultsSummary?: string, resultsCount?: number }
 * Requires authentication middleware to set req.user = { _id, ... }
 */
export const saveSearchAndThread = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { threadId, query, params = {}, resultsSummary = null, resultsCount = null } = req.body;
    if (!query) return res.status(400).json({ message: "query is required" });

    const finalThreadId = threadId || uuidv4();

    const update = {
      $push: {
        // keep user-visible message history (role: user)
        messages: {
          role: "user",
          content: query,
          timestamp: new Date()
        },
        // structured search metadata for analytics / later display
        searches: {
          query,
          params,
          resultsSummary,
          resultsCount,
          timestamp: new Date()
        }
      },
      $setOnInsert: {
        threadId: finalThreadId,
        owner: userId,
        // set initial title to a short version of the query
        title: query.length > 60 ? query.slice(0, 57) + "..." : query
      }
    };

    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };

    const thread = await Thread.findOneAndUpdate(
      { owner: userId, threadId: finalThreadId },
      update,
      opts
    );

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("saveSearchAndThread err:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
