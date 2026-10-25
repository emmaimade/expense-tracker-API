import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { generateToken, hashToken } from "../utils/tokens.js";
import { validatePassword } from "../utils/validators.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import { isValidCurrency, getCurrencySymbol } from "../utils/currency.js";
import { getConversionRate } from '../utils/exchange.js';
import { detectCurrency } from '../utils/geoCurrency.js';
import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';
import Category from '../models/Category.js';
import sendEmail from "../utils/email.js";
import {
  welcomeEmail,
  verifyEmailEmail,
  forgotPasswordEmail,
  resetPasswordConfirmEmail,
  profileUpdatedEmail,
  emailChangeCurrentEmail,
  emailChangeNewEmail,
  emailChangedConfirmEmail,
  emailChangedOldAddressNotification,
  passwordChangedEmail,
  currencyUpdatedEmail,
  accountDeletedEmail,
} from "../utils/emailTemplates.js";

// Shared user shape for register, login, /me and profile updates.
// `name` is kept alongside `fullName` for older frontend builds.
const formatUser = (user) => {
  const fullName = `${user.firstName} ${user.lastName}`;
  const currency = user.currency || "USD";
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName,
    name: fullName,
    email: user.email,
    currency,
    currencySymbol: getCurrencySymbol(currency),
    firstLoginAt: user.firstLoginAt,
    lastLoginAt: user.lastLoginAt,
    emailVerified: user.emailVerified !== false,
    hasPassword: hasPassword(user),
  };
};

// Accounts created through Google store a random placeholder, not a bcrypt
// hash, so they have no password the user knows
const hasPassword = (user) => typeof user.password === "string" && /^\$2[aby]\$\d{2}\$/.test(user.password);

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Only send optional notification emails to confirmed addresses, so typos
// and fake sign-ups don't cause bounces that hurt our sender reputation
const canEmail = (user) => user.emailVerified !== false;

// Save a new verification token on the user and email the confirmation link
const sendVerificationEmail = async (user) => {
  const { raw, hash } = generateToken();
  user.emailVerificationToken = hash;
  user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
  await user.save();

  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${raw}`;
  await sendEmail({
    to: user.email,
    subject: "Confirm your SpendWise email",
    html: verifyEmailEmail({ firstName: user.firstName, verifyUrl }),
  });
};

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
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
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

    const user = await User.create({
      firstName, lastName, email, password: hashedPassword, currency: userCurrency, emailVerified: false,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    // Ask the user to confirm their address; the welcome email follows once they do.
    // A failure here doesn't block sign-up - they can resend from the dashboard.
    try {
      await sendVerificationEmail(user);
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: formatUser(user),
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
      user: formatUser(user),
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

    const { raw: resetToken, hash: resetTokenHash } = generateToken();
    user.resetPasswordToken = resetTokenHash;
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

    if (typeof token !== "string" || !token) return res.status(400).json({ success: false, message: "Password reset link is invalid or has expired. Please request a new one." });
    if (!password || !confirmPassword) return res.status(400).json({ success: false, message: "Both fields are required" });
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (password !== confirmPassword) return res.status(400).json({ success: false, message: "Passwords do not match" });

    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Password reset link is invalid or has expired. Please request a new one." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    // Using the emailed reset link proves the user owns this address
    user.emailVerified = true;
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

      // The new-email token is generated once the current email is verified
      const { raw: currentEmailToken, hash: currentEmailTokenHash } = generateToken();
      const tokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

      user.emailChangeRequest = {
        newEmail: email,
        currentEmailToken: currentEmailTokenHash,
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
    if (!changes.includes("Email change initiated - check your current email") && canEmail(user)) {
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
        ...formatUser(user),
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
    if (typeof token !== "string" || !token) return res.status(400).json({ success: false, message: "Verification token is required" });

    const user = await User.findOne({
      'emailChangeRequest.currentEmailToken': hashToken(token),
      'emailChangeRequest.expiresAt': { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired verification token" });

    const { raw: newEmailToken, hash: newEmailTokenHash } = generateToken();
    user.emailChangeRequest.currentEmailVerified = true;
    user.emailChangeRequest.newEmailToken = newEmailTokenHash;
    await user.save();

    try {
      const verifyUrl = `${process.env.BASE_URL}/user/verify-email-change/new?token=${newEmailToken}`;
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
    if (typeof token !== "string" || !token) return res.status(400).json({ success: false, message: "Verification token is required" });

    const user = await User.findOne({
      'emailChangeRequest.newEmailToken': hashToken(token),
      'emailChangeRequest.currentEmailVerified': true,
      'emailChangeRequest.expiresAt': { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ success: false, message: "Invalid verification token, or current email not verified yet" });

    const oldEmail = user.email;
    const newEmail = user.emailChangeRequest.newEmail;

    user.email = newEmail;
    user.emailChangeRequest = undefined;
    // The new address was confirmed by clicking the link sent to it
    user.emailVerified = true;
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
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (newPassword !== confirmNewPassword) return res.status(400).json({ success: false, message: "New passwords do not match" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) return res.status(401).json({ success: false, message: "Current password is incorrect" });

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) return res.status(400).json({ success: false, message: "New password must be different from current password" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    if (canEmail(user)) {
      try {
        await sendEmail({
          to: user.email,
          subject: "Password Changed Successfully",
          html: passwordChangedEmail({ firstName: user.firstName, email: user.email }),
        });
      } catch (emailError) {
        console.error("Error sending password change email:", emailError);
      }
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

    if (shouldConvert && hasExistingData && canEmail(user)) {
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

// ── Verify Email ──────────────────────────────────────────────────
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (typeof token !== "string" || !token) {
      return res.status(400).json({ success: false, message: "Verification token is required" });
    }

    const user = await User.findOne({
      emailVerificationToken: hashToken(token),
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This confirmation link is invalid, already used, or expired.",
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "Welcome to SpendWise!",
        html: welcomeEmail({
          firstName: user.firstName,
          email: user.email,
          userCurrency: user.currency,
          currencySymbol: getCurrencySymbol(user.currency),
        }),
      });
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
    }

    res.status(200).json({ success: true, message: "Email confirmed. Welcome to SpendWise!", user: formatUser(user) });
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── Resend Verification Email ─────────────────────────────────────
const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.emailVerified !== false) {
      return res.status(400).json({ success: false, message: "Your email is already confirmed" });
    }

    try {
      await sendVerificationEmail(user);
    } catch (emailError) {
      console.error("Error resending verification email:", emailError);
      return res.status(500).json({ success: false, message: "Couldn't send the confirmation email. Please try again later." });
    }

    res.status(200).json({ success: true, message: `Confirmation email sent to ${user.email}` });
  } catch (error) {
    console.error("Error resending verification email:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── Delete Account ────────────────────────────────────────────────
// Permanently deletes the user and everything they own. Password accounts
// confirm with their password; Google-only accounts type "DELETE".
const deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { password, confirmation } = req.body || {};
    if (hasPassword(user)) {
      if (typeof password !== "string" || !password) {
        return res.status(400).json({ success: false, message: "Please enter your password to confirm" });
      }
      if (!(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ success: false, message: "Password is incorrect" });
      }
    } else if (confirmation !== "DELETE") {
      return res.status(400).json({ success: false, message: 'Type "DELETE" to confirm' });
    }

    const { email, firstName } = user;
    const notify = canEmail(user);

    // Delete owned data first and the user last, so a failure part-way
    // through leaves an account the user can retry deleting from
    const [expenses, budgets, categories] = await Promise.all([
      Expense.deleteMany({ userId: user._id }),
      Budget.deleteMany({ userId: user._id }),
      Category.deleteMany({ userId: user._id, isDefault: false }),
    ]);
    await User.deleteOne({ _id: user._id });

    if (notify) {
      try {
        await sendEmail({
          to: email,
          subject: "Your SpendWise account has been deleted",
          html: accountDeletedEmail({ firstName }),
        });
      } catch (emailError) {
        console.error("Error sending account deletion email:", emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: "Your account and all of your data have been permanently deleted",
      deleted: {
        expenses: expenses.deletedCount,
        budgets: budgets.deletedCount,
        categories: categories.deletedCount,
      },
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ── Get Current User ──────────────────────────────────────────────
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.cleanupExpiredEmailChange()) await user.save();

    res.status(200).json({
      success: true,
      user: {
        ...formatUser(user),
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
  verifyEmail,
  resendVerification,
  deleteAccount,
};
