// routes/chat.js
console.log("[routes/chat] loaded");
console.log("OPENAI FILE PATH:", new URL("../utils/openai.js", import.meta.url).pathname);

import express from "express";
import Thread from "../models/Thread.js";
import authMiddleware from "../middleware/auth.js";
import {
  classifyMedicineQuery,
  getMedicineDetails,
  getMedicinePricingAndGenerics
} from "../utils/openai.js";
import crypto from "crypto";

const router = express.Router();

// Protect everything
router.use(authMiddleware);

/* -------------------- helpers -------------------- */
const hasValidIncomingId = (id) => {
  if (!id || typeof id !== "string") return false;
  const t = id.trim();
  if (!t || t === "undefined" || t === "null") return false;
  return true;
};

const makeId = (bytes = 6) => crypto.randomBytes(bytes).toString("hex");

function simpleSanitize(input) {
  if (!input) return "";
  return String(input).replace(/<\/?[^>]+(>|$)/g, "");
}

/* -------------------- threads -------------------- */
router.get("/thread", async (req, res) => {
  try {
    const ownerId = req.user.id;
    const threads = await Thread.find({ owner: ownerId })
      .sort({ updatedAt: -1 })
      .select("threadId title messages createdAt updatedAt")
      .lean();

    return res.json({ ok: true, threads });
  } catch (err) {
    console.error("GET /thread error:", err);
    return res.status(500).json({ error: "Failed to fetch threads" });
  }
});

router.get("/thread/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;
    const ownerId = req.user.id;

    const thread = await Thread.findOne({ threadId, owner: ownerId }).lean();
    if (!thread) return res.status(404).json({ error: "Thread not found" });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("GET /thread/:threadId error:", err);
    return res.status(500).json({ error: "Failed to fetch thread" });
  }
});

/* -------------------- MAIN CHAT -------------------- */
router.post("/chat", async (req, res) => {
  const { threadId: incomingThreadIdRaw, message } = req.body;
  const ownerId = req.user.id;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const incomingThreadId = hasValidIncomingId(incomingThreadIdRaw)
      ? incomingThreadIdRaw.trim()
      : null;

    let thread;

    // Thread resolution
    if (incomingThreadId) {
      thread = await Thread.findOne({ threadId: incomingThreadId, owner: ownerId });

      if (!thread) {
        const orphan = await Thread.findOne({ threadId: incomingThreadId });
        if (orphan && orphan.owner == null) {
          orphan.owner = ownerId;
          orphan.title = simpleSanitize(orphan.title);
          await orphan.save();
          thread = orphan;
        } else {
          thread = new Thread({
            threadId: `t-${makeId(10)}`,
            owner: ownerId,
            title: message,
            messages: []
          });
        }
      }
    } else {
      thread = new Thread({
        threadId: `t-${makeId(10)}`,
        owner: ownerId,
        title: message,
        messages: []
      });
    }

    // Save user message
    thread.messages.push({
      role: "user",
      content: message,
      timestamp: new Date()
    });

    /* --------- 1️⃣ CLASSIFY --------- */
    const classifier = await classifyMedicineQuery(message);

    if (!classifier?.is_medicine || classifier.confidence < 0.6) {
      const reply = "This medicine is not present in the database.";

      thread.messages.push({
        role: "assistant",
        content: reply,
        timestamp: new Date()
      });

      await thread.save();

      return res.json({
        present: false,
        reply,
        threadId: thread.threadId
      });
    }

    const normalizedName = classifier.normalized_name || message;

    /* --------- 2️⃣ FETCH DETAILS + GENERICS --------- */
    const medicineDetails = await getMedicineDetails(normalizedName);
    const pricingAndGenerics = await getMedicinePricingAndGenerics(normalizedName);

     console.log("\n================ MEDICINE SEARCH =================");
console.log("👤 User ID       :", ownerId);
console.log("💊 Medicine Name :", normalizedName);
console.log("🕒 Time          :", new Date().toLocaleString());

console.log("\n📘 MEDICINE DETAILS");
console.log(JSON.stringify(medicineDetails, null, 2));

console.log("\n💰 PRICING & GENERICS");
console.log(JSON.stringify(pricingAndGenerics, null, 2));

console.log("=================================================\n");
    const combinedResponse = {
      medicine_details: medicineDetails,
      pricing_and_generics: pricingAndGenerics
  
    };
   
    /* --------- 3️⃣ SAVE ASSISTANT MESSAGE --------- */
    thread.messages.push({
      role: "assistant",
      content: JSON.stringify(combinedResponse, null, 2),
      timestamp: new Date()
    });

    thread.updatedAt = new Date();
    await thread.save();

    /* --------- 4️⃣ SEND RESPONSE --------- */
    return res.status(200).json({
      present: true,
      details: combinedResponse,
      reply: combinedResponse,
      threadId: thread.threadId
    });

  } catch (err) {
    console.error("POST /chat error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
