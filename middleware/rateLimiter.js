import rateLimit from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000; // 15 min

const tooMany = (message) => ({ success: false, message });

// Limit brute-force attempts on public auth endpoints (per IP)
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  // AUTH_RATE_LIMIT lets the test suite raise the limit; production uses 10
  limit: Number(process.env.AUTH_RATE_LIMIT) || 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany("Too many attempts. Please try again in 15 minutes."),
});

// The API is also reachable directly (not only through the Vercel proxy), where a
// client can fake X-Forwarded-For and dodge the per-IP limit. These limiters key
// on the account's email instead, which can't be rotated the same way.
const emailKey = (req) =>
  typeof req.body?.email === "string" && req.body.email.trim()
    ? `email:${req.body.email.trim().toLowerCase()}`
    : `ip:${req.ip}`;

// Failed sign-ins per account (successful ones don't count)
export const loginAccountLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.ACCOUNT_RATE_LIMIT) || 10,
  keyGenerator: emailKey,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany("Too many failed sign-in attempts for this account. Please try again in 15 minutes or reset your password."),
});

// Password-reset emails per account, so nobody can flood someone's inbox
export const resetEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: Number(process.env.ACCOUNT_RATE_LIMIT) || 5,
  keyGenerator: emailKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany("Too many password reset requests for this email. Please try again in an hour."),
});

export default authLimiter;
