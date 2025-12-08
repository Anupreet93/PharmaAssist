// middleware/errorHandler.js

export default function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const code = err.code || "internal_error";

  console.error("\n🔥 ERROR LOG START");
  console.error("Time:", new Date().toISOString());
  console.error("Request ID:", req.id);
  console.error("URL:", req.method, req.originalUrl);
  console.error("Status:", status);
  console.error("Code:", code);
  console.error("Message:", err.message);
  if (err.stack) console.error("Stack:", err.stack);
  if (err.meta) console.error("Meta:", err.meta);
  console.error("🔥 ERROR LOG END\n");

  return res.status(status).json({
    success: false,
    error: {
      code,
      message: status >= 500 ? "Internal server error" : err.message
    }
  });
}
