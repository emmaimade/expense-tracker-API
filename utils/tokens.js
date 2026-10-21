import crypto from "crypto";

// Hash a token before storing or looking it up, so a database leak
// doesn't expose usable reset/verification links
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Generate a random token: `raw` goes in the email link, `hash` goes in the database
export function generateToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export default { hashToken, generateToken };
