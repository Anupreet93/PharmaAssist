// routes/medicine.js
import express from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  classifyMedicineQuery,
  getMedicineDetails
} from "../utils/openai.js";

const router = express.Router();

// Tunable values
const CONF_THRESHOLD = 0.6;
const MAX_QUERY_LENGTH = 200; // characters

/**
 * POST /api/medicine/search
 * Body: { query: string }
 */
router.post(
  "/search",
  asyncHandler(async (req, res) => {
    let { query } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ success: false, error: "query is required" });
    }

    // normalize input
    query = query.trim();
    if (query.length === 0) {
      return res.status(400).json({ success: false, error: "query cannot be empty" });
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({ success: false, error: `query too long (max ${MAX_QUERY_LENGTH} chars)` });
    }

    // 1) Classify
    const classifier = await classifyMedicineQuery(query);
    if (!classifier) {
      // upstream classifier failed (e.g., OpenAI/Groq unavailable)
      return res.status(502).json({ success: false, error: "Classifier unavailable" });
    }

    const { is_medicine, normalized_name, confidence } = classifier;

    // If classifier says no or low confidence -> tell UI it's not present/recognized
    if (!is_medicine || confidence < CONF_THRESHOLD || !normalized_name) {
      return res.status(200).json({
        success: true,
        present: false,
        message: "This medicine is not present in DB or not recognized.",
        classifier
      });
    }

    // 2) Fetch details using the normalized name
    const details = await getMedicineDetails(normalized_name);

    if (!details) {
      // the item is recognized but details lookup failed (upstream issue)
      return res.status(502).json({
        success: false,
        present: true,
        message: "Medicine recognized but details could not be loaded.",
        classifier,
        details: null
      });
    }

    // Success
    return res.status(200).json({
      success: true,
      present: true,
      classifier,
      details
    });
  })
);

export default router;

