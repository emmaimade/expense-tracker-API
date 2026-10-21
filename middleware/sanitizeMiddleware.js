// Reject requests containing MongoDB operator keys (e.g. ?token[$ne]=x or
// {"email": {"$gt": ""}}) so user input can never be interpreted as a query selector.
const hasOperatorKey = (value) => {
  if (!value || typeof value !== "object") return false;

  return Object.keys(value).some(
    (key) => key.startsWith("$") || key.includes(".") || hasOperatorKey(value[key])
  );
};

const sanitizeMiddleware = (req, res, next) => {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query)) {
    return res.status(400).json({
      success: false,
      message: "Invalid characters in request",
    });
  }
  next();
};

export default sanitizeMiddleware;
