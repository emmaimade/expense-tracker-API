import rateLimit from "express-rate-limit";

// Limit brute-force attempts on public auth endpoints (per IP)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

export default authLimiter;
