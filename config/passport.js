import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const firstName = profile.name.givenName;
        const lastName = profile.name.familyName;

        // Find existing user or create new one
        let user = await User.findOne({ email });

        if (!user) {
          // New user — create with no password (Google users don't need one)
          user = await User.create({
            firstName,
            lastName,
            email,
            password: 'GOOGLE_AUTH_' + Math.random().toString(36), // placeholder
            currency: 'USD', // default, they can change in settings
            googleId: profile.id,
          });
        } else if (!user.googleId) {
          // Existing email user — link Google to their account
          user.googleId = profile.id;
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

export default passport;