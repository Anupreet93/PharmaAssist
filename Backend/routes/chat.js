// routes/chat.js
console.log("[routes/chat] loaded");

import express from "express";
import Thread from "../models/Thread.js";
import authMiddleware from "../middleware/auth.js";
import {
  classifyMedicineQuery,
  getMedicineDetails
} from "../utils/openai.js";
import crypto from "crypto";

const router = express.Router();

// Protect everything in this router
router.use(authMiddleware);

// ---------- helpers ----------
const hasValidIncomingId = (id) => {
  if (!id) return false;
  if (typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  if (trimmed === "undefined" || trimmed === "null") return false;
  return true;
};

const makeId = (bytes = 6) => crypto.randomBytes(bytes).toString("hex");

// lightweight sanitize fallback (optional)
function simpleSanitize(input) {
  if (input == null) return "";
  const s = String(input);
  const withoutTags = s.replace(/<\/?[^>]+(>|$)/g, "");
  return withoutTags.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// ---------- list / single thread endpoints (unchanged) ----------
router.get("/thread", async (req, res) => {
  try {
    const ownerId = req.user.id;
    const threads = await Thread.find({ owner: ownerId })
      .sort({ updatedAt: -1 })
      .select("threadId title createdAt updatedAt messages")
      .lean();

    return res.json({ ok: true, threads });
  } catch (err) {
    console.error("GET /thread error:", err);
    return res.status(500).json({ error: "Failed to fetch threads" });
  }
});

router.get("/thread/:threadId", async (req, res) => {
  const { threadId } = req.params;
  const ownerId = req.user.id;

  try {
    const thread = await Thread.findOne({ threadId, owner: ownerId }).lean();
    if (!thread) return res.status(404).json({ error: "Thread not found" });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("GET /thread/:threadId error:", err);
    return res.status(500).json({ error: "Failed to fetch thread" });
  }
});

router.delete("/thread/:threadId", async (req, res) => {
  const { threadId } = req.params;
  const ownerId = req.user.id;

  try {
    const deleted = await Thread.findOneAndDelete({ threadId, owner: ownerId });
    if (!deleted) return res.status(404).json({ error: "Thread not found or not owned by you" });

    return res.json({ ok: true, message: "Thread deleted successfully" });
  } catch (err) {
    console.error("DELETE /thread/:threadId error:", err);
    return res.status(500).json({ error: "Failed to delete thread" });
  }
});

router.post("/thread", async (req, res) => {
  try {
    const owner = req.user.id;
    const { title, messages } = req.body;
    const threadId = `t-${makeId(8)}`;

    const thread = new Thread({
      threadId,
      owner,
      title: title || "New Chat",
      messages: Array.isArray(messages) ? messages : []
    });

    await thread.save();
    return res.status(201).json({ ok: true, thread });
  } catch (err) {
    console.error("POST /thread error:", err);
    if (err.code === 11000) return res.status(409).json({ error: "Thread id collision" });
    return res.status(500).json({ error: "Failed to create thread" });
  }
});

router.post("/thread/:threadId/messages", async (req, res) => {
  const { threadId } = req.params;
  const { role, content } = req.body;
  const ownerId = req.user.id;

  if (!role || !content) return res.status(400).json({ error: "role and content required" });
  if (!["user", "assistant"].includes(role)) return res.status(400).json({ error: "invalid role" });

  try {
    const update = {
      $push: { messages: { role, content, timestamp: new Date() } },
      $set: { updatedAt: new Date() }
    };

    const thread = await Thread.findOneAndUpdate({ threadId, owner: ownerId }, update, { new: true });
    if (!thread) return res.status(404).json({ error: "Thread not found or not owned by user" });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("POST /thread/:threadId/messages error:", err);
    return res.status(500).json({ error: "Failed to append message" });
  }
});

// ---------- chat endpoint (main assistant flow) ----------
router.post("/chat", async (req, res) => {
  const { threadId: incomingThreadIdRaw, message } = req.body;
  const ownerId = req.user.id;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "missing required field: message" });
  }

  try {
    const incomingThreadId = hasValidIncomingId(incomingThreadIdRaw) ? incomingThreadIdRaw.trim() : null;

    console.log(`[CHAT] owner=${ownerId} incomingThreadId=${incomingThreadId}`);

    // Determine thread to use/create
    let thread = null;

    if (incomingThreadId) {
      // try to find a thread owned by this user with that id
      thread = await Thread.findOne({ threadId: incomingThreadId, owner: ownerId });

      if (!thread) {
        // not owned by this user. Check if thread exists but owner is null (orphan).
        const maybeOrphan = await Thread.findOne({ threadId: incomingThreadId }).exec();
        if (maybeOrphan && (maybeOrphan.owner === null || maybeOrphan.owner === undefined)) {
          // Claim orphan for this user
          maybeOrphan.owner = ownerId;
          // optionally sanitize the title
          if (maybeOrphan.title) maybeOrphan.title = simpleSanitize(maybeOrphan.title);
          await maybeOrphan.save();
          thread = maybeOrphan;
          console.log(`[CHAT] claimed orphan thread ${incomingThreadId} for user ${ownerId}`);
        } else {
          // either doesn't exist or owned by someone else -> create a new thread for this user
          const newThreadId = `t-${makeId(10)}`;
          thread = new Thread({
            threadId: newThreadId,
            owner: ownerId,
            title: message,
            messages: []
          });
          console.log(`[CHAT] created new thread ${newThreadId} because incoming id wasn't available to user ${ownerId}`);
        }
      }
    } else {
      // No threadId supplied -> create a brand new thread owned by the user
      const newThreadId = `t-${makeId(10)}`;
      thread = new Thread({
        threadId: newThreadId,
        owner: ownerId,
        title: message,
        messages: []
      });
    }

    // Append user's message
    thread.messages.push({ role: "user", content: message, timestamp: new Date() });

    // 1) classify
    const classifier = await classifyMedicineQuery(message);

    if (!classifier || !classifier.is_medicine || (typeof classifier.confidence === "number" && classifier.confidence < 0.6)) {
      const reply = "This medicine is not present in DB.";

      thread.messages.push({ role: "assistant", content: reply, timestamp: new Date() });
      thread.updatedAt = new Date();
      await thread.save();

      // return threadId so frontend can persist it (and show in sidebar)
      return res.status(200).json({
        present: false,
        reply,
        threadId: thread.threadId
      });
    }

    // 2) get details
    const normalizedName = classifier.normalized_name ?? classifier.name ?? null;
    const details = normalizedName ? await getMedicineDetails(normalizedName) : null;

    if (!details) {
      const reply = "Medicine recognized but details could not be loaded.";

      thread.messages.push({ role: "assistant", content: reply, timestamp: new Date() });
      thread.updatedAt = new Date();
      await thread.save();

      return res.status(200).json({
        present: true,
        reply,
        threadId: thread.threadId
      });
    }

    // 3) assistant message
    const assistantReply = typeof details === "string" ? details : JSON.stringify(details, null, 2);

    thread.messages.push({ role: "assistant", content: assistantReply, timestamp: new Date() });
    thread.updatedAt = new Date();
    await thread.save();

    // Return threadId so frontend can keep showing this chat under user's history
    return res.status(200).json({
      present: true,
      details,
      reply: assistantReply,
      threadId: thread.threadId
    });
  } catch (err) {
    console.error("Unexpected error in /chat:", err);
    return res.status(500).json({ error: "something went wrong" });
  }
});

export default router;
