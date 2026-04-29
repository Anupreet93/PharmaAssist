// server.js
import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import path from "path";
import cookieParser from "cookie-parser";

import helmet from "helmet";
import rateLimit from "express-rate-limit";

// routes
import chatRoutes from "./routes/chat.js";
import medicineRoutes from "./routes/medicine.js";
import authRoutes from "./routes/auth.js";

// middleware
import errorHandler from "./middleware/errorHandler.js";
import authMiddleware from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 8080;

app.set("trust proxy", 1);

/* =====================================================
   ENV CHECK
===================================================== */
if (!process.env.JWT_SECRET) {
  console.warn("⚠️ JWT_SECRET is missing");
}

<<<<<<< HEAD
// --- security middlewares ---
// In development we relax COOP/COEP so embedded Google Identity iframe / postMessage works.
// In production we apply helmet normally (you can tune the options as needed).
if (process.env.NODE_ENV !== "production") {
  try {
    app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false
  })
);

  } catch (e) {
    console.warn("helmet not installed or dev-helmet configuration failed — run: npm i helmet");
  }
} else {
  try {
    app.use(helmet());
  } catch (e) {
    console.warn("helmet not installed — run: npm i helmet");
  }
}
=======
/* =====================================================
   HELMET (GOOGLE OAUTH SAFE)
===================================================== */
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'", "https://accounts.google.com"],
        "frame-src": ["'self'", "https://accounts.google.com"],
        "connect-src": [
          "'self'",
          "https://accounts.google.com",
          "https://oauth2.googleapis.com"
        ]
      }
    }
  })
);
>>>>>>> 93868d0 (Updated Backend)

/* =====================================================
   RATE LIMIT
===================================================== */
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || "120", 10),
    standardHeaders: true,
    legacyHeaders: false
  })
);

/* =====================================================
   BODY PARSERS
===================================================== */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* =====================================================
   CORS CONFIG (SAFE)
===================================================== */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim().replace(/\/+$/, "").toLowerCase())
  .filter(Boolean);

console.log("🌐 CORS allowedOrigins:", allowedOrigins);

function normalizeOrigin(origin) {
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`.toLowerCase();
  } catch {
    return origin.toLowerCase();
  }
}

function corsOriginCallback(origin, callback) {
  if (!origin) return callback(null, true);

  const normalized = normalizeOrigin(origin);

  if (allowedOrigins.length === 0 || allowedOrigins.includes(normalized)) {
    return callback(null, true);
  }

  return callback(new Error("CORS policy: Origin not allowed"), false);
}

app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true
  })
);

// ✅ Express 5 compatible preflight
app.options("/*", cors({
  origin: corsOriginCallback,
  credentials: true
}));

/* =====================================================
   REQUEST ID + LOGGER
===================================================== */
app.use((req, res, next) => {
  req.id = crypto.randomBytes(6).toString("hex");
  res.setHeader("X-Request-Id", req.id);
  next();
});

app.use((req, res, next) => {
  console.log(
    `[REQ ${new Date().toISOString()}] id=${req.id} ${req.method} ${req.originalUrl}`
  );
  next();
});

/* =====================================================
   HEALTH CHECK
===================================================== */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    time: new Date().toISOString(),
    requestId: req.id
  });
});

/* =====================================================
   ROUTES
===================================================== */
app.use("/api/auth", authRoutes);
app.use("/api", chatRoutes);
app.use("/api/medicine", medicineRoutes);

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/* =====================================================
   API 404 HANDLER
===================================================== */
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({
      ok: false,
      error: "API route not found",
      path: req.originalUrl
    });
  }
  next();
});

/* =====================================================
   SERVE FRONTEND (EXPRESS 5 SAFE)
===================================================== */
if (process.env.CLIENT_BUILD_PATH) {
  const clientPath = path.resolve(process.env.CLIENT_BUILD_PATH);
  app.use(express.static(clientPath));

  // ❗ MUST be /* (NOT *)
  app.get("/*", (req, res) => {
    if (req.path.startsWith("/api")) return;
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

/* =====================================================
   ERROR HANDLER
===================================================== */
app.use((err, req, res, next) => {
  if (err?.message?.includes("CORS")) {
    return res.status(403).json({ error: err.message });
  }

  console.error("❌ Server error:", err);

  if (typeof errorHandler === "function") {
    return errorHandler(err, req, res, next);
  }

  res.status(500).json({ error: "Internal server error" });
});

/* =====================================================
   START SERVER
===================================================== */
const startServer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) throw new Error("MONGODB_URI missing");

    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DBNAME,
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });

    console.log("✅ MongoDB connected");

    const server = app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );

    const shutdown = async signal => {
      console.log(`\n${signal} received. Shutting down...`);
      server.close();
      await mongoose.disconnect();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();

/* =====================================================
   GLOBAL GUARDS
===================================================== */
process.on("unhandledRejection", reason =>
  console.error("Unhandled Rejection:", reason)
);

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
