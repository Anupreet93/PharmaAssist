// controllers/googleAuthController.js
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * POST /api/auth/google
 * body: { id_token: string }
 * Returns: { token, user }
 */
export async function googleAuthHandler(req, res) {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ error: "id_token is required" });

    // verify id_token
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    // payload contains email, name, picture, sub (google user id)
    const { sub: googleId, email, name, picture } = payload;

    if (!email) return res.status(400).json({ error: "Google account has no email" });

    // Try to find existing user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // If user exists but doesn't have googleId saved, attach it (link accounts)
      if (!user.googleId) {
        user.googleId = googleId;
      }
      // update name/avatar if changed
      user.name = user.name || name;
      user.avatar = user.avatar || picture;
      await user.save();
    } else {
      // create new user
      user = await User.create({
        name,
        email,
        googleId,
        avatar: picture
        // passwordHash left blank for google-only user
      });
    }

    // Issue your own JWT (same as you use elsewhere)
    const token = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      ok: true,
      token,
      user: {
        _id: user._id,
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error("googleAuthHandler err:", err);
    return res.status(500).json({ error: "Failed to authenticate with Google" });
  }
}
