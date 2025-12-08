// models/User.js
import mongoose from "mongoose";
import crypto from "crypto";

const UserSchema = new mongoose.Schema(
  {
    // public, stable user id (UUID)
    userId: {
      type: String,
      required: true,
      unique: true,
      default: () => {
        // prefer crypto.randomUUID (Node 14.17+, Node 20+). Fallback to a random hex if unavailable.
        if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
        return crypto.randomBytes(16).toString("hex");
      }
    },

    name: { type: String, default: null },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
