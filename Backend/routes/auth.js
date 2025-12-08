// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { signAccessToken } from "../utils/tokens.js";
import { OAuth2Client } from "google-auth-library";

const router = express.Router();

// Google OAuth client (reads from env)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/signup
 * (email/password signup)
 */
router.post(
  "/signup",
  body("email").isEmail().withMessage("Invalid email"),
  body("password").isLength({ min: 6 }).withMessage("Password must be >= 6 chars"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      const { name } = req.body;
      const email = (req.body.email || "").toString().trim().toLowerCase();
      const password = (req.body.password || "").toString();

      if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Email and password are required" });
      }

      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ ok: false, error: "Email already registered" });

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = new User({ name: name || null, email, passwordHash });
      await user.save();

      const token = signAccessToken({ sub: user._id, email: user.email });

      return res.status(201).json({
        ok: true,
        message: "User created",
        token,
        user: { id: user._id, name: user.name, email: user.email }
      });
    } catch (err) {
      console.error("Signup error:", err);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  }
);

/**
 * POST /api/auth/login
 * (email/password login)
 */
router.post(
  "/login",
  body("email").isEmail().withMessage("Invalid email"),
  body("password").exists().withMessage("Password required"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
      }

      const email = (req.body.email || "").toString().trim().toLowerCase();
      const password = (req.body.password || "").toString();

      if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Email and password are required" });
      }

      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ ok: false, error: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) return res.status(401).json({ ok: false, error: "Invalid credentials" });

      const token = signAccessToken({ sub: user._id, email: user.email });

      return res.json({
        ok: true,
        message: "Logged in",
        token,
        user: { id: user._id, name: user.name, email: user.email }
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  }
);

/**
 * POST /api/auth/google
 * Body: { id_token }
 *
 * Verifies the id_token with Google, then creates or finds a User,
 * and returns your app's JWT and user object.
 */
router.post("/google", async (req, res) => {
  try {
    const id_token = req.body?.id_token;
    if (!id_token) return res.status(400).json({ ok: false, error: "id_token is required" });

    if (!GOOGLE_CLIENT_ID) {
      console.error("Google client id (GOOGLE_CLIENT_ID) not configured on server");
      return res.status(500).json({ ok: false, error: "Server configuration error" });
    }

    // Verify token with google-auth-library
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: id_token,
        audience: GOOGLE_CLIENT_ID
      });
    } catch (err) {
      console.warn("Google verifyIdToken failed:", err?.message || err);
      return res.status(401).json({ ok: false, error: "Invalid Google ID token" });
    }

    const payload = ticket.getPayload();
    // payload includes: sub (google user id), email, email_verified, name, picture, etc.
    const googleSub = payload.sub;
    const email = (payload.email || "").toString().toLowerCase();
    const name = payload.name || null;
    const emailVerified = !!payload.email_verified;

    if (!email) {
      return res.status(400).json({ ok: false, error: "Google account has no email" });
    }

    // Upsert user in DB: if user exists, update name (optional); otherwise create
    let user = await User.findOne({ email });

    if (!user) {
      // create a new user. We don't have a passwordHash for social users.
      user = new User({
        name,
        email,
        passwordHash: Math.random().toString(36).slice(2) // random placeholder if your schema requires it
      });
      await user.save();
    } else {
      // optionally update user's name if missing
      if (!user.name && name) {
        user.name = name;
        await user.save();
      }
    }

    const token = signAccessToken({ sub: user._id, email: user.email });

    return res.json({
      ok: true,
      message: "Google login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, emailVerified }
    });
  } catch (err) {
    console.error("Google auth route error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
