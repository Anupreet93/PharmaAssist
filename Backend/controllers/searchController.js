// controllers/searchController.js
import Thread from "../models/Thread.js";
import MedicineCache from "../models/MedicineCache.js";
import { v4 as uuidv4 } from "uuid";

import {
  classifyMedicineQuery,
  getMedicineDetails,
  getMedicinePricingAndGenerics
} from "../utils/openai.js";

export const saveSearchAndThread = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { threadId, query } = req.body;
    if (!query) {
      return res.status(400).json({ message: "query is required" });
    }

    const finalThreadId = threadId || uuidv4();

    /* 1️⃣ Validate medicine */
    const classification = await classifyMedicineQuery(query);
    if (!classification?.is_medicine) {
      return res.status(400).json({ message: "Not a medicine query" });
    }

    /* 2️⃣ Cache-first */
    let cached = await MedicineCache.findOne({ query: query.toLowerCase() });
    let fromCache = true;

    if (!cached) {
      fromCache = false;

      const details = await getMedicineDetails(query);
      const pricing = await getMedicinePricingAndGenerics(query);

      cached = await MedicineCache.create({
        query: query.toLowerCase(),
        medicine_details: details,
        pricing_and_generics: pricing
      });
    }

    const assistantPayload = {
      medicine_details: cached.medicine_details,
      pricing_and_generics: cached.pricing_and_generics,
      meta: { cached: fromCache }
    };

    /* 3️⃣ Save chat + search */
    const thread = await Thread.findOneAndUpdate(
      { owner: userId, threadId: finalThreadId },
      {
        $push: {
          messages: [
            { role: "user", content: query },
            {
              role: "assistant",
              content: JSON.stringify(assistantPayload)
            }
          ],
          searches: {
            query,
            resultsSummary: `Found ${
              cached.pricing_and_generics?.generic_alternatives?.length || 0
            } generic alternatives`,
            resultsCount:
              cached.pricing_and_generics?.generic_alternatives?.length || 0
          }
        },
        $setOnInsert: {
          threadId: finalThreadId,
          owner: userId,
          title: query.length > 60 ? query.slice(0, 57) + "..." : query
        }
      },
      { upsert: true, new: true }
    );

    return res.json({
      ok: true,
      threadId: finalThreadId,
      data: assistantPayload
    });
  } catch (err) {
    console.error("Search controller error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
