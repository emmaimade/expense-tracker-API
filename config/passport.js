import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const initializePassport = () => {
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
          const loginTime = new Date();

          let user = await User.findOne({ email });

          if (!user) {
            user = await User.create({
              firstName,
              lastName,
              email,
              password: 'GOOGLE_AUTH_' + Math.random().toString(36),
              currency: 'USD',
              googleId: profile.id,
              firstLoginAt: loginTime,
              lastLoginAt: loginTime,
            });
          } else {
            if (!user.googleId) user.googleId = profile.id;
            if (!user.firstLoginAt) user.firstLoginAt = loginTime;
            user.lastLoginAt = loginTime;
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  return passport;
};

export default passport;
