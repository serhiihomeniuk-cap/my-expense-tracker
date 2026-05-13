import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { UserService } from '../models/User';

const router = express.Router();

// Configure Passport strategies - only if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await UserService.findOrCreate('google', profile.id, {
        email: profile.emails?.[0]?.value,
        displayName: profile.displayName,
        avatarUrl: profile.photos?.[0]?.value
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  }));
} else {
  console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/auth/github/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await UserService.findOrCreate('github', profile.id, {
        email: profile.emails?.[0]?.value,
        displayName: profile.displayName || profile.username,
        avatarUrl: profile.photos?.[0]?.value
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  }));
} else {
  console.warn('⚠️  GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env');
}

// Serialize/deserialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await UserService.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`, session: false }),
  (req, res) => {
    const user = req.user as any;
    const token = jwt.sign(
      { user: { id: user.id, provider: user.provider, providerUserId: user.provider_user_id, email: user.email, displayName: user.display_name } },
      process.env.JWT_SECRET || 'test-secret-key',
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`);
  }
);

// GitHub OAuth routes
router.get('/github',
  passport.authenticate('github', { scope: ['user:email'], session: false })
);

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`, session: false }),
  (req, res) => {
    const user = req.user as any;
    const token = jwt.sign(
      { user: { id: user.id, provider: user.provider, providerUserId: user.provider_user_id, email: user.email, displayName: user.display_name } },
      process.env.JWT_SECRET || 'test-secret-key',
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`);
  }
);

// Get current user info
router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key') as any;
    const user = await UserService.findById(decoded.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      provider: user.provider,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    });
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  // In a stateless JWT setup, logout is handled on the client side
  // by removing the token from storage
  res.json({ message: 'Logged out successfully' });
});

export default router;
