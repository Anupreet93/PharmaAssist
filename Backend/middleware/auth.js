// middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    if (!JWT_SECRET) {
      console.error("JWT_SECRET is not configured in environment");
      return res.status(500).json({ error: "Server configuration error" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // payload.sub is expected to contain the user's ObjectId (string)
    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // fetch user from DB (exclude sensitive fields)
    const user = await User.findById(payload.sub).select("_id email name");
    if (!user) return res.status(401).json({ error: "User not found" });

    // Attach the mongoose user document (with _id) and a string id for convenience
    req.user = {
      _id: user._id,
      id: user._id.toString(),
      email: user.email,
      name: user.name || null
    };

    return next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
