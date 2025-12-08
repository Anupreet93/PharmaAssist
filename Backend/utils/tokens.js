// utils/tokens.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const ACCESS_EXPIRES_IN = process.env.ACCESS_EXPIRES_IN || "7d";

export function signAccessToken(payload = {}) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET not set");
  }
  // payload should include sub (user id) and any minimal claims you need
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

export function verifyAccessToken(token) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET not set");
  return jwt.verify(token, JWT_SECRET);
}
