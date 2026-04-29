// models/MedicineCache.js
import mongoose from "mongoose";

const MedicineCacheSchema = new mongoose.Schema(
  {
    query: { type: String, unique: true, index: true },
    medicine_details: Object,
    pricing_and_generics: Object
  },
  { timestamps: true }
);

export default mongoose.model("MedicineCache", MedicineCacheSchema);
