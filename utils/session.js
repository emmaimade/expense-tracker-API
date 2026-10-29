import jwt from "jsonwebtoken";
import Session from "../models/Session.js";
import { generateToken, hashToken } from "./tokens.js";

// Short-lived access token + long-lived, rotating refresh token, both in
// httpOnly cookies the page's JavaScript can't read.
export const ACCESS_COOKIE = "sw_access";
export const REFRESH_COOKIE = "sw_refresh";
const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// How long a just-rotated refresh token is still accepted (concurrent tabs)
const ROTATION_GRACE_MS = 30 * 1000;

const cookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  // Browsers only send Secure cookies over HTTPS; local dev and tests use HTTP
  secure: process.env.NODE_ENV === "production",
  // Lax: sent on same-site requests and top-level navigations, not on
  // cross-site POSTs - this is our CSRF protection
  sameSite: "lax",
  path: "/",
  maxAge: maxAgeMs,
});

const signAccessToken = (userId, sessionId) =>
  jwt.sign({ id: userId, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS });

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_TTL_SECONDS * 1000));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_TTL_MS));
};

export const clearAuthCookies = (res) => {
  const { maxAge, ...options } = cookieOptions(0);
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
};

const createSessionRecord = async (userId, req) => {
  const refresh = generateToken();
  const session = await Session.create({
    userId,
    refreshTokenHash: refresh.hash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: req.get("user-agent")?.slice(0, 300),
  });
  return { session, refreshToken: refresh.raw };
};

/**
 * Start a new session for a user who just signed in: store it and set both
 * cookies. Returns the access token (still sent in the JSON body for older
 * frontends during the switch to cookies).
 */
export const startSession = async (res, req, userId) => {
  const { session, refreshToken } = await createSessionRecord(userId, req);
  const accessToken = signAccessToken(userId, session._id);
  setAuthCookies(res, accessToken, refreshToken);
  return accessToken;
};

/** Revoke every active session for a user, optionally keeping one. */
export const revokeUserSessions = (userId, { except } = {}) =>
  Session.updateMany(
    { userId, revokedAt: null, ...(except && { _id: { $ne: except } }) },
    { revokedAt: new Date() }
  );

/**
 * Exchange the refresh cookie for a new session (rotation).
 * Returns the userId, or null if the refresh token is missing/invalid.
 */
export const rotateSession = async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (typeof raw !== "string" || !raw) return null;

  const current = await Session.findOne({ refreshTokenHash: hashToken(raw) });
  if (!current || current.expiresAt <= new Date()) return null;

  // Signed out (logout, password change, account deletion): just refuse
  if (current.revokedAt && !current.replacedBy) return null;

  if (current.replacedBy) {
    // Two tabs refreshing at the same moment both present the same token;
    // the second one arrives just after rotation. Allow that briefly.
    const justRotated = Date.now() - current.revokedAt.getTime() < ROTATION_GRACE_MS;
    if (!justRotated) {
      // An old refresh token came back long after it was used: it was probably
      // copied. Sign the user out everywhere to cut off whoever has it.
      await revokeUserSessions(current.userId);
      return null;
    }
    return issueRotated(res, req, current.userId);
  }

  const next = await createSessionRecord(current.userId, req);
  // Claim the rotation atomically; if another request beat us to it, fall
  // back to the same grace path instead of failing
  const claimed = await Session.updateOne(
    { _id: current._id, replacedBy: null, revokedAt: null },
    { replacedBy: next.session._id, revokedAt: new Date() }
  );
  if (claimed.modifiedCount === 0) {
    await Session.deleteOne({ _id: next.session._id });
    return issueRotated(res, req, current.userId);
  }

  setAuthCookies(res, signAccessToken(current.userId, next.session._id), next.refreshToken);
  return current.userId;
};


// Start a fresh session for a request that lost a concurrent-refresh race
const issueRotated = async (res, req, userId) => {
  await startSession(res, req, userId);
  return userId;
};

/** End the session behind this request's cookies (used by logout). */
export const endSession = async (req) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (typeof raw === "string" && raw) {
    await Session.updateOne({ refreshTokenHash: hashToken(raw), revokedAt: null }, { revokedAt: new Date() });
  }
  if (req.user?.sid) {
    await Session.updateOne({ _id: req.user.sid, revokedAt: null }, { revokedAt: new Date() });
  }
};
