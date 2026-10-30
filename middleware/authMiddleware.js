import jwt from "jsonwebtoken";
import Session from "../models/Session.js";
import { ACCESS_COOKIE } from "../utils/session.js";

// Authenticates with the httpOnly access cookie set at sign-in
const authMiddleware = async (req, res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (typeof token !== "string" || !token) {
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
    // Sessions end immediately on logout, password change or account deletion
    const active = decoded.sid
      && await Session.exists({ _id: decoded.sid, userId: decoded.id, revokedAt: null });
    if (!active) {
      return res.status(401).json({ success: false, message: "Your session has ended. Please sign in again." });
    }
  } catch (error) {
    return next(error);
  }

  req.user = decoded;
  next();
};

export default authMiddleware;
