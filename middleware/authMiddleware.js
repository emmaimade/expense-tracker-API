import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { ACCESS_COOKIE } from "../utils/session.js";

// Accepts the httpOnly access cookie, or an Authorization: Bearer header from
// clients that still use tokens (the frontend before cookies, API tools).
const getToken = (req) => {
  const cookie = req.cookies?.[ACCESS_COOKIE];
  if (typeof cookie === "string" && cookie) return cookie;

  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7);
  return null;
};

const authMiddleware = async (req, res, next) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Access Denied" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // 401 for an expired token tells the client to refresh its session
    const status = error.name === "TokenExpiredError" ? 401 : 403;
    return res.status(status).json({ success: false, message: "Invalid or expired token" });
  }

  try {
    // Session tokens die as soon as their session is revoked (logout, password
    // change, account deletion). Older tokens without a session only need the
    // account to still exist.
    const stillValid = decoded.sid
      ? await Session.exists({ _id: decoded.sid, userId: decoded.id, revokedAt: null })
      : await User.exists({ _id: decoded.id });
    if (!stillValid) {
      return res.status(401).json({ success: false, message: "Your session has ended. Please sign in again." });
    }
  } catch (error) {
    return next(error);
  }

  req.user = decoded;
  next();
};

export default authMiddleware;
