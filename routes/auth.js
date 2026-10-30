import express from 'express';
import passport from 'passport';
import { startSession } from '../utils/session.js';

const router = express.Router();

// BASE_URL must point at the frontend's /api proxy (e.g.
// https://<frontend>/api) so Google redirects back through the app's own
// domain and the session cookies are set there.

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
      res.redirect(`${process.env.FRONTEND_URL.replace(/\/$/, '')}/auth/callback`);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
