import express from "express";
import { detectCurrency } from "../utils/geoCurrency.js";

import {
  registerUser, 
  loginUser, 
  forgotPassword, 
  resetPassword,
  updateProfile,
  verifyCurrentEmail,
  verifyNewEmail,
  changePassword,
  updateCurrency,
  getCurrentUser
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes (no auth required)
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email-change/current', verifyCurrentEmail);
router.get('/verify-email-change/new', verifyNewEmail);

// NEW: Currency detection endpoint (no auth needed - for registration)
router.get('/detect-currency', (req, res) => {
  try {
    const currency = detectCurrency(req);
    const clientIP = getClientIP(req);
    
    res.json({
      success: true,
      currency,
      symbol: getCurrencySymbol(currency),
      detectedFrom: clientIP,
      message: `Currency ${currency} detected from your location`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to detect currency',
      fallback: 'USD'
    });
  }
});

// Protected routes (auth required)
router.get('/me', authMiddleware, getCurrentUser);
router.put('/profile', authMiddleware, updateProfile);
router.put('/currency', authMiddleware, updateCurrency);
router.put('/change-password', authMiddleware, changePassword);

export default router;