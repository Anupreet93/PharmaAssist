// routes/threads.js
import express from "express";
import Thread from "../models/Thread.js";
import authMiddleware from "../middleware/auth.js";
import { nanoid } from "nanoid";

const router = express.Router();

// protect all routes in this router
router.use(authMiddleware);

/**
 * GET /api/threads
 * List threads for the authenticated user
 */
router.get("/", async (req, res) => {
  try {
    const ownerId = req.user.id;
    const threads = await Thread.find({ owner: ownerId })
      .sort({ updatedAt: -1 })
      .select("threadId title createdAt updatedAt messages")
      .lean();
    return res.json({ ok: true, threads });
  } catch (err) {
    console.error("GET /api/threads error:", err);
    return res.status(500).json({ error: "Failed to fetch threads" });
  }
});

/**
 * POST /api/threads
 * Create a new thread for the authenticated user
 * body: { title?: string, messages?: [] }
 */
router.post("/", async (req, res) => {
  try {
    const owner = req.user.id;
    const { title, messages } = req.body;
    const threadId = `t-${nanoid(8)}`;

    const thread = new Thread({
      threadId,
      owner,
      title: title || "New Chat",
      messages: Array.isArray(messages) ? messages : []
    });

    await thread.save();
    return res.status(201).json({ ok: true, thread });
  } catch (err) {
    console.error("POST /api/threads error:", err);
    if (err.code === 11000) return res.status(409).json({ error: "Thread id collision" });
    return res.status(500).json({ error: "Failed to create thread" });
  }
});

/**
 * GET /api/threads/:threadId
 * Get a single thread owned by the user
 */
router.get("/:threadId", async (req, res) => {
  try {
    const owner = req.user.id;
    const { threadId } = req.params;
    const thread = await Thread.findOne({ threadId, owner }).lean();
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("GET /api/threads/:threadId error:", err);
    return res.status(500).json({ error: "Failed to fetch thread" });
  }
});

/**
 * POST /api/threads/:threadId/messages
 * Append a message to an owned thread
 * body: { role: "user"|"assistant", content: "..." }
 */
router.post("/:threadId/messages", async (req, res) => {
  try {
    const owner = req.user.id;
    const { threadId } = req.params;
    const { role, content } = req.body;

    if (!role || !content) return res.status(400).json({ error: "role and content required" });
    if (!["user", "assistant"].includes(role)) return res.status(400).json({ error: "invalid role" });

    const update = {
      $push: { messages: { role, content, timestamp: new Date() } },
      $set: { updatedAt: new Date() }
    };

    const thread = await Thread.findOneAndUpdate({ threadId, owner }, update, { new: true });
    if (!thread) return res.status(404).json({ error: "Thread not found or not owned by user" });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("POST /api/threads/:threadId/messages error:", err);
    return res.status(500).json({ error: "Failed to append message" });
  }
});

/**
 * DELETE /api/threads/:threadId
 * Delete a thread owned by the user
 */
router.delete("/:threadId", async (req, res) => {
  try {
    const owner = req.user.id;
    const { threadId } = req.params;
    const deleted = await Thread.findOneAndDelete({ threadId, owner });
    if (!deleted) return res.status(404).json({ error: "Thread not found or not owned by you" });
    return res.json({ ok: true, message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/threads/:threadId error:", err);
    return res.status(500).json({ error: "Failed to delete thread" });
  }
});

export default router;
