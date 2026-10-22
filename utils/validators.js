// Returns an error message if the password is too weak, otherwise null
export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 6) {
    return "Password must be at least 6 characters long";
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return "Password must contain at least one lowercase letter, one uppercase letter, and one number";
  }
  return null;
}

// The furthest-ahead timezone is UTC+14, so a user's "today" can be up to
// 14 hours ahead of the server's UTC clock
const MAX_TIMEZONE_AHEAD_MS = 14 * 60 * 60 * 1000;

// True if the date is in the future for every timezone on Earth
export function isFutureDate(date) {
  return date.getTime() > Date.now() + MAX_TIMEZONE_AHEAD_MS;
}

export default { validatePassword, isFutureDate };
