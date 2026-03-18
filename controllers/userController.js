import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import { isValidCurrency, getCurrencySymbol } from "../utils/currency.js";
import { getConversionRate } from '../utils/exchange.js';
import { detectCurrency } from '../utils/geoCurrency.js';
import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';
import sendEmail from "../utils/email.js";
import {
  welcomeEmail,
  forgotPasswordEmail,
  resetPasswordConfirmEmail,
  profileUpdatedEmail,
  emailChangeCurrentEmail,
  emailChangeNewEmail,
  emailChangedConfirmEmail,
  emailChangedOldAddressNotification,
  passwordChangedEmail,
  currencyUpdatedEmail,
} from "../utils/emailTemplates.js";

// ── Register ──────────────────────────────────────────────────────
const registerUser = async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword, currency } = req.body;

  try {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Please fill all the fields" });
    }
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Firstname or Lastname must be at least 2 characters long" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ success: false, message: "Password must contain at least one lowercase letter, one uppercase letter, and one number" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }
    if (!currency) {
      return res.status(400).json({ success: false, message: "Please select your preferred currency", suggestedCurrency: detectCurrency(req) });
    }
    if (!isValidCurrency(currency)) {
      return res.status(400).json({ success: false, message: 'Invalid currency code. Please select a valid currency.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCurrency = currency.toUpperCase();

    const user = await User.create({ firstName, lastName, email, password: hashedPassword, currency: userCurrency });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    // Send welcome email
    try {
      await sendEmail({
        to: email,
        subject: "Welcome to SpendWise!",
        html: welcomeEmail({
          firstName,
          email,
          userCurrency,
          currencySymbol: getCurrencySymbol(userCurrency),
        }),
      });
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        currency: user.currency,
        currencySymbol: getCurrencySymbol(user.currency),
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── Login ─────────────────────────────────────────────────────────
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and Password is required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const loginTime = new Date();
    const isFirstLogin = !user.firstLoginAt;
    if (!user.firstLoginAt) user.firstLoginAt = loginTime;
    user.lastLoginAt = loginTime;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        currency: user.currency || 'USD',
        firstLoginAt: user.firstLoginAt,
        lastLoginAt: user.lastLoginAt,
      },
      isFirstLogin,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── Forgot Password ───────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether email exists
      return res.status(200).json({ success: true, message: "If an account with that email exists, a password reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: email,
      subject: "Password Reset Request",
      html: forgotPasswordEmail({ firstName: user.firstName, resetUrl }),
    });

    res.status(200).json({ success: true, message: "Password reset email sent successfully" });
  } catch (err) {
    console.error("Error sending password reset email:", err);
    res.status(500).json({ success: false, message: "Error sending password reset email" });
  }
};

// ── Reset Password ────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token } = req.query;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) return res.status(400).json({ success: false, message: "Both fields are required" });
    if (password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return res.status(400).json({ success: false, message: "Password must contain at least one lowercase letter, one uppercase letter, and one number" });
    if (password !== confirmPassword) return res.status(400).json({ success: false, message: "Passwords do not match" });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Password reset link is invalid or has expired. Please request a new one." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Successfully Reset",
        html: resetPasswordConfirmEmail({ firstName: user.firstName, email: user.email }),
      });
    } catch (emailError) {
      console.error("Error sending reset confirmation email:", emailError);
    }

    res.status(200).json({ success: true, message: "Password reset successfully. You can now log in with your new password." });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ success: false, message: "An internal error occurred while resetting your password" });
  }
};

// ── Update Profile ────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, email, currentPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!currentPassword) return res.status(400).json({ success: false, message: "Current password is required to update profile" });

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) return res.status(401).json({ success: false, message: "Current password is incorrect" });

    const changes = [];

    if (firstName && firstName !== user.firstName) {
      if (firstName.trim().length < 2) return res.status(400).json({ success: false, message: "First name must be at least 2 characters long" });
      user.firstName = firstName.trim();
      changes.push("First name");
    }

    if (lastName && lastName !== user.lastName) {
      if (lastName.trim().length < 2) return res.status(400).json({ success: false, message: "Last name must be at least 2 characters long" });
      user.lastName = lastName.trim();
      changes.push("Last name");
    }

    if (email && email !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: "Invalid email format" });

      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ success: false, message: "Email already in use" });

      const currentEmailToken = crypto.randomBytes(32).toString("hex");
      const newEmailToken = crypto.randomBytes(32).toString("hex");
      const tokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

      user.emailChangeRequest = {
        newEmail: email,
        currentEmailToken,
        newEmailToken,
        currentEmailVerified: false,
        newEmailVerified: false,
        expiresAt: tokenExpires,
      };

      try {
        const verifyUrl = `${process.env.BASE_URL}/user/verify-email-change/current?token=${currentEmailToken}`;
        await sendEmail({
          to: user.email,
          subject: "Confirm Email Change Request",
          html: emailChangeCurrentEmail({ firstName: user.firstName, currentEmail: user.email, newEmail: email, verifyUrl }),
        });
        changes.push("Email change initiated - check your current email");
      } catch (emailError) {
        console.error("Error sending verification email:", emailError);
        return res.status(500).json({ success: false, message: "Error sending verification email" });
      }
    }

    if (changes.length === 0) return res.status(400).json({ success: false, message: "No changes detected" });

    await user.save();

    // Send profile update confirmation (only for non-email changes)
    if (!changes.includes("Email change initiated - check your current email")) {
      try {
        await sendEmail({
          to: user.email,
          subject: "Profile Updated Successfully",
          html: profileUpdatedEmail({ firstName: user.firstName, changes }),
        });
      } catch (emailError) {
        console.error("Error sending profile update email:", emailError);
      }
    }

    return res.status(200).json({
      success: true,
      message: changes.includes("Email change initiated - check your current email")
        ? "Email change initiated. Please check your current email to verify and proceed."
        : "Profile updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        ...(user.emailChangeRequest && { emailChangeInProgress: true, newEmailPending: user.emailChangeRequest.newEmail }),
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── Verify Current Email ──────────────────────────────────────────
const verifyCurrentEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: "Verification token is required" });

    const user = await User.findOne({
      'emailChangeRequest.currentEmailToken': token,
      'emailChangeRequest.expiresAt': { $gt: new Date() },
    }).select('+emailChangeRequest.newEmailToken');

    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired verification token" });

    user.emailChangeRequest.currentEmailVerified = true;
    await user.save();

    try {
      const verifyUrl = `${process.env.BASE_URL}/user/verify-email-change/new?token=${user.emailChangeRequest.newEmailToken}`;
      await sendEmail({
        to: user.emailChangeRequest.newEmail,
        subject: "Verify Your New Email Address",
        html: emailChangeNewEmail({
          firstName: user.firstName,
          currentEmail: user.email,
          newEmail: user.emailChangeRequest.newEmail,
          verifyUrl,
        }),
      });
    } catch (emailError) {
      console.error("Error sending new email verification:", emailError);
      return res.status(500).json({ success: false, message: "Error sending verification to new email" });
    }

    res.status(200).json({ success: true, message: "Current email verified! Please check your new email to complete the change." });
  } catch (error) {
    console.error("Error verifying current email:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── Verify New Email ──────────────────────────────────────────────
const verifyNewEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: "Verification token is required" });

    const user = await User.findOne({
      'emailChangeRequest.newEmailToken': token,
      'emailChangeRequest.currentEmailVerified': true,
      'emailChangeRequest.expiresAt': { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ success: false, message: "Invalid verification token, or current email not verified yet" });

    const oldEmail = user.email;
    const newEmail = user.emailChangeRequest.newEmail;

    user.email = newEmail;
    user.emailChangeRequest = undefined;
    await user.save();

    try {
      await Promise.all([
        sendEmail({
          to: newEmail,
          subject: "Email Successfully Changed",
          html: emailChangedConfirmEmail({ firstName: user.firstName, oldEmail, newEmail }),
        }),
        sendEmail({
          to: oldEmail,
          subject: "Email Address Changed",
          html: emailChangedOldAddressNotification({ firstName: user.firstName, oldEmail, newEmail }),
        }),
      ]);
    } catch (emailError) {
      console.error("Error sending confirmation emails:", emailError);
    }

    res.status(200).json({ success: true, message: "Email successfully changed! Please log in with your new email address.", newEmail });
  } catch (error) {
    console.error("Error verifying new email:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── Change Password ───────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) return res.status(400).json({ success: false, message: "All fields are required" });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: "New password must be at least 6 characters long" });
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) return res.status(400).json({ success: false, message: "Password must contain at least one lowercase letter, one uppercase letter, and one number" });
    if (newPassword !== confirmNewPassword) return res.status(400).json({ success: false, message: "New passwords do not match" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) return res.status(401).json({ success: false, message: "Current password is incorrect" });

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) return res.status(400).json({ success: false, message: "New password must be different from current password" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Changed Successfully",
        html: passwordChangedEmail({ firstName: user.firstName, email: user.email }),
      });
    } catch (emailError) {
      console.error("Error sending password change email:", emailError);
    }

    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── Update Currency ───────────────────────────────────────────────
const updateCurrency = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currency, convertExisting } = req.body;

    if (!currency) return res.status(400).json({ success: false, message: 'Currency is required' });
    if (!isValidCurrency(currency)) return res.status(400).json({ success: false, message: 'Invalid currency code.' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const oldCurrency = user.currency || 'USD';
    const newCurrency = currency.toUpperCase();

    if (oldCurrency === newCurrency) {
      return res.status(200).json({ success: true, message: 'Currency is already set to ' + newCurrency, data: { currency: newCurrency, currencySymbol: getCurrencySymbol(newCurrency) } });
    }

    const [expenseCount, budgetCount] = await Promise.all([
      Expense.countDocuments({ userId }),
      Budget.countDocuments({ userId }),
    ]);

    const hasExistingData = expenseCount > 0 || budgetCount > 0;

    if (hasExistingData && (convertExisting === undefined || convertExisting === null)) {
      return res.status(400).json({
        success: false,
        message: 'You have existing expenses or budgets. Please specify whether to convert them.',
        requiresConversion: true,
        existingData: { expenseCount, budgetCount, currentCurrency: oldCurrency, newCurrency },
      });
    }

    const shouldConvert = convertExisting === true || convertExisting === 'true';

    let rate;
    try {
      rate = await getConversionRate(oldCurrency, newCurrency);
    } catch (err) {
      return res.status(502).json({ success: false, message: 'Failed to fetch exchange rate. Please try again later.' });
    }

    let expenseUpdateResult = { matchedCount: 0, modifiedCount: 0 };
    let budgetUpdateResult = { matchedCount: 0, modifiedCount: 0 };

    if (shouldConvert && hasExistingData) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          if (expenseCount > 0) {
            expenseUpdateResult = await Expense.updateMany(
              { userId },
              [{ $set: {
                amountOriginal: { $cond: { if: { $gt: [{ $ifNull: ["$amountOriginal", null] }, null] }, then: "$amountOriginal", else: "$amount" } },
                currencyOriginal: { $cond: { if: { $gt: [{ $ifNull: ["$currencyOriginal", null] }, null] }, then: "$currencyOriginal", else: oldCurrency } },
                amount: { $round: [{ $multiply: ["$amount", rate] }, 2] },
                conversionRate: rate, convertedAt: "$$NOW", convertedFrom: oldCurrency, convertedTo: newCurrency,
              }}],
              { session }
            );
          }
          if (budgetCount > 0) {
            budgetUpdateResult = await Budget.updateMany(
              { userId },
              [{ $set: {
                amountOriginal: { $cond: { if: { $gt: [{ $ifNull: ["$amountOriginal", null] }, null] }, then: "$amountOriginal", else: "$amount" } },
                currencyOriginal: { $cond: { if: { $gt: [{ $ifNull: ["$currencyOriginal", null] }, null] }, then: "$currencyOriginal", else: oldCurrency } },
                amount: { $round: [{ $multiply: ["$amount", rate] }, 2] },
                conversionRate: rate, convertedAt: "$$NOW", convertedFrom: oldCurrency, convertedTo: newCurrency,
              }}],
              { session }
            );
          }
        });
        await session.endSession();
      } catch (conversionError) {
        await session.endSession();
        return res.status(500).json({ success: false, message: 'Failed to convert existing data. Your currency was not changed.' });
      }
    }

    user.currency = newCurrency;
    user.lastCurrencyChange = {
      from: oldCurrency, to: newCurrency, rate, changedAt: new Date(),
      dataConverted: shouldConvert,
      expensesConverted: expenseUpdateResult.modifiedCount || 0,
      budgetsConverted: budgetUpdateResult.modifiedCount || 0,
    };
    await user.save();

    if (shouldConvert && hasExistingData) {
      try {
        await sendEmail({
          to: user.email,
          subject: 'Currency Successfully Updated',
          html: currencyUpdatedEmail({
            firstName: user.firstName,
            oldCurrency,
            newCurrency,
            oldSymbol: getCurrencySymbol(oldCurrency),
            newSymbol: getCurrencySymbol(newCurrency),
            rate,
            expensesConverted: expenseUpdateResult.modifiedCount || 0,
            budgetsConverted: budgetUpdateResult.modifiedCount || 0,
            shouldConvert,
          }),
        });
      } catch (emailError) {
        console.error('Error sending currency update email:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: shouldConvert
        ? `Currency updated to ${newCurrency}. ${expenseUpdateResult.modifiedCount} expenses and ${budgetUpdateResult.modifiedCount} budgets converted successfully.`
        : `Currency preference updated to ${newCurrency}. Existing data amounts unchanged.`,
      data: {
        currency: user.currency,
        currencySymbol: getCurrencySymbol(user.currency),
        oldCurrency, conversionRate: rate, dataConverted: shouldConvert,
        lastCurrencyChange: user.lastCurrencyChange,
        conversion: shouldConvert ? {
          expenses: { total: expenseCount, converted: expenseUpdateResult.modifiedCount || 0, matched: expenseUpdateResult.matchedCount || 0 },
          budgets: { total: budgetCount, converted: budgetUpdateResult.modifiedCount || 0, matched: budgetUpdateResult.matchedCount || 0 },
        } : null,
      },
    });
  } catch (err) {
    console.error('Error updating currency:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ── Get Current User ──────────────────────────────────────────────
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.cleanupExpiredEmailChange()) await user.save();

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        currency: user.currency || 'USD',
        email: user.email,
        firstLoginAt: user.firstLoginAt,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ...(user.emailChangeRequest && user.hasEmailChangeInProgress() && {
          emailChangeInProgress: true,
          newEmailPending: user.emailChangeRequest.newEmail,
          currentEmailVerified: user.emailChangeRequest.currentEmailVerified,
        }),
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  updateProfile,
  verifyCurrentEmail,
  verifyNewEmail,
  changePassword,
  updateCurrency,
  getCurrentUser,
};
