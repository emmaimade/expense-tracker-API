import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ success: false, message: "Access Denied" });
  }

  let decoded;
  try {
    decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ success: false, message: "Invalid or expired token" });
  }

  try {
    // Tokens outlive deleted accounts, so make sure the account still exists
    if (!(await User.exists({ _id: decoded.id }))) {
      return res.status(401).json({ success: false, message: "This account no longer exists" });
    }
  } catch (error) {
    return next(error);
  }

  req.user = decoded;
  next();
};

export default authMiddleware;
