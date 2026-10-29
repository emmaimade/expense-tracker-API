import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { startSession } from '../utils/session.js';

const router = express.Router();

// When BASE_URL points at the frontend's /api proxy, Google redirects back
// through the app's own domain, so the session cookies land on that domain and
// no token needs to travel in the URL. Otherwise (BASE_URL = the API's own
// address) keep the old flow, which passes a token to the frontend in the URL.
export const callbackRedirectUrl = (userId, { baseUrl, frontendUrl, secret }) => {
  const sameSite = new URL(baseUrl).host === new URL(frontendUrl).host;
  if (sameSite) return `${frontendUrl}/auth/callback`;

  const token = jwt.sign({ id: userId }, secret, { expiresIn: '1d' });
  return `${frontendUrl}/auth/callback?token=${token}&userId=${userId}`;
};

// Step 1 - Redirect user to Google
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Step 2 - Google redirects back here
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed` }),
  async (req, res, next) => {
    try {
      await startSession(res, req, req.user._id);
      res.redirect(callbackRedirectUrl(req.user._id, {
        baseUrl: process.env.BASE_URL,
        frontendUrl: process.env.FRONTEND_URL.replace(/\/$/, ''),
        secret: process.env.JWT_SECRET,
      }));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
