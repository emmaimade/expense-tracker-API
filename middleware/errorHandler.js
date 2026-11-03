// Central handler for errors that reach Express (thrown in middleware or passed to next()).
// Client errors (4xx) carry messages we wrote for the user, so they pass through. Server
// errors (5xx) can carry internal details (database or library messages), so the client gets
// a generic message and the details only go to the server log.
export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  // express.json() rejects a malformed body with a SyntaxError tagged with this type
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "The request body is not valid JSON",
      timestamp: new Date().toISOString(),
    });
  }

  const raw = Number(error.status || error.statusCode);
  const status = raw >= 400 && raw <= 599 ? raw : 500;
  const isServerError = status >= 500;

  if (isServerError) console.error("Unhandled error:", error);

  return res.status(status).json({
    success: false,
    message: isServerError
      ? "Something went wrong. Please try again."
      : error.message || "Request failed",
    ...(process.env.NODE_ENV === "development" && { error: error.stack }),
    timestamp: new Date().toISOString(),
  });
};

export default errorHandler;
