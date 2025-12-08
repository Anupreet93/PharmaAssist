// routes/search.js
import express from "express";
import { saveSearchAndThread } from "../controllers/searchController.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

router.post("/", requireAuth, saveSearchAndThread);

export default router;
