import rateLimit from "express-rate-limit";

// Limit brute-force attempts on public auth endpoints (per IP)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  // AUTH_RATE_LIMIT lets the test suite raise the limit; production uses 10
  limit: Number(process.env.AUTH_RATE_LIMIT) || 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

export default authLimiter;
