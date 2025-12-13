// server.js
import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import path from "path";
import cookieParser from "cookie-parser";

// optional security middlewares
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// route imports
import chatRoutes from "./routes/chat.js";
import medicineRoutes from "./routes/medicine.js";
import authRoutes from "./routes/auth.js";

// middleware
import errorHandler from "./middleware/errorHandler.js";
import authMiddleware from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 8080;

app.set("trust proxy", 1);

// --- ENV sanity checks ---
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET not set in production.");
    process.exit(1);
  }
} else {
  if (!process.env.JWT_SECRET) {
    console.warn("Warning: JWT_SECRET missing — set it in .env");
  }
}

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

try {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || "120", 10),
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);
} catch (e) {
  console.warn("express-rate-limit missing — run: npm i express-rate-limit");
}

// --- JSON parsing ---
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// --- CORS ---
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || "";
const allowedOrigins = allowedOriginsEnv.split(",").map(s => s.trim()).filter(Boolean);

function corsOriginCallback(origin, callback) {
  // allow non-browser clients (curl/postman) which don't send origin
  if (!origin) return callback(null, true);

  // in dev, allow all if not explicitly configured
  if (process.env.NODE_ENV !== "production" && allowedOrigins.length === 0) {
    return callback(null, true);
  }

  if (allowedOrigins.length > 0) {
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS policy: Origin not allowed"), false);
  }

  return callback(null, true);
}

app.use(cors({
  origin: corsOriginCallback,
  credentials: true
}));

app.use(cookieParser());

// --- Request ID middleware ---
app.use((req, res, next) => {
  req.id = crypto.randomBytes(6).toString("hex");
  res.setHeader("X-Request-Id", req.id);
  next();
});

// TEMPORARY DEBUG LOGGER
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || "";
  console.log(`[REQ ${new Date().toISOString()}] id=${req.id} method=${req.method} path=${req.path} origin=${origin} auth=${!!req.headers.authorization}`);
  next();
});

// --- Health check ---
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    time: new Date().toISOString(),
    requestId: req.id,
    env: process.env.NODE_ENV || "development"
  });
});

// --- ROUTES ---
// Public: authentication
app.use("/api/auth", authRoutes);

// Chat and medicine routers are expected to define their own paths
app.use("/api", chatRoutes);
app.use("/api/medicine", medicineRoutes);

// Example protected route
app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/**
 * UNMATCHED API HANDLER
 * ---------------------
 * If request path starts with /api but no route matched, return a clear 404 JSON.
 */
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.warn(`[NOT FOUND] id=${req.id} ${req.method} ${req.originalUrl} — no API route matched`);
    return res.status(404).json({
      ok: false,
      error: "API route not found",
      path: req.originalUrl
    });
  }
  return next();
});

// --- Serve frontend build (optional) ---
if (process.env.CLIENT_BUILD_PATH) {
  const clientPath = path.resolve(process.env.CLIENT_BUILD_PATH);
  app.use(express.static(clientPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

// --- Error handler ---
app.use((err, req, res, next) => {
  if (err && err.message?.includes("CORS")) {
    return res.status(403).json({ error: err.message });
  }
  if (typeof errorHandler === "function") {
    return errorHandler(err, req, res, next);
  }

  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// --- Start server after DB connects ---
const startServer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error("Error: MONGODB_URI missing from .env");
      process.exit(1);
    }

    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DBNAME || undefined,
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log("✅ MongoDB connected");

    const server = app.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );

    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}, shutting down...`);
      server.close(() => console.log("HTTP server closed"));
      await mongoose.disconnect();
      console.log("MongoDB disconnected");
      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();

// --- Global error handlers ---
process.on("unhandledRejection", reason => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
