import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import createTransporter from "../utils/email.js";

// Create user
const registerUser = async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  try {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Please fill all the fields" 
      });
    }

    if (firstName.trim() < 2 || lastName.trim() < 2) {
      return res.status(400).json({
        success: false,
        messsage: "Firstname or Lastname must be at least 2 characters long"
      })
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Both fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least one lowercase letter, one uppercase letter, and one number",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Login user
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and Password is required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Forgot Password
const forgotPassword = async(req, res) => {
  try {
    const { email } = req.body;

    if(!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + (15 * 60 * 1000)); // 15 minutes in milliseconds

    // Save token and expiry to database
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    const transporter = createTransporter();

    // Generate reset link
    const resetUrl = `${process.env.BASE_URL}/user/reset-password?token=${resetToken}`;

    // Email options
    const mailOptions = {
      from: `Expense Tracker <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You requested a password reset for your account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" 
             style="background-color: #4B0082; color: white; padding: 10px 20px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
          <p>Or copy and paste this link into your browser:</p>
          <p>${resetUrl}</p>
          <p>This link will expire in 15 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Password reset email sent successfully"
    });
  } catch (err) {
    console.error("Error sending password reset email:", err);
    res.status(500).json({
      success: false,
      message: "Error sending password reset email"
    });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { token } = req.query;
    const { password, confirmPassword } = req.body;

    // Validate input
    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Both fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least one lowercase letter, one uppercase letter, and one number",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const now = new Date();
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: now },
    });
    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Password reset link is invalid or has expired. Please request a new one.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (err) {
    console.error("Error resetting password", err);
    res.status(500).json({
      success: false,
      message: "An internal error occurred while resetting your password",
    });
  }
};

export { registerUser, loginUser, forgotPassword, resetPassword };
