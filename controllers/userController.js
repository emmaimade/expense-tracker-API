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

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Firstname or Lastname must be at least 2 characters long"
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
      return res.status(400).json({ 
        success: false,
        message: "User already exists" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    // Send welcome email
    try {
      const transporter = createTransporter();
      
      const mailOptions = {
        from: `Expense Tracker <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Welcome to Expense Tracker!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4B0082;">Welcome to Expense Tracker, ${firstName}!</h2>
            <p>Thank you for creating an account with us.</p>
            <p>We're excited to help you manage your expenses and take control of your finances.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Getting Started:</h3>
              <ul style="color: #555;">
                <li>Log in to your account</li>
                <li>Start tracking your expenses</li>
                <li>Set up budgets and categories</li>
                <li>View insightful reports</li>
              </ul>
            </div>
            
            <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
            
            <p style="margin-top: 30px;">Best regards,<br>The Expense Tracker Team</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #888;">
              This email was sent to ${email}. If you didn't create this account, please contact our support team immediately.
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
      // Don't fail registration if email fails
    }

    res.status(201).json({ 
      success: true,
      message: "User created successfully", 
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal Server Error" 
    });
  }
};

// Login user
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      success: false,
      message: "Email and Password is required" 
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal Server Error" 
    });
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
    const resetTokenExpires = new Date(Date.now() + (15 * 60 * 1000)); // 15 minutes

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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${user.firstName},</p>
          <p>You requested a password reset for your Expense Tracker account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #4B0082; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
            ${resetUrl}
          </p>
          <p style="color: #d9534f; font-weight: bold;">⚠️ This link will expire in 15 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #888;">
            For security reasons, we cannot reset your password for you. If you continue to have problems, please contact our support team.
          </p>
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

    // Send password reset confirmation email
    try {
      const transporter = createTransporter();
      
      const mailOptions = {
        from: `Expense Tracker <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Password Successfully Reset",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #28a745;">✓ Password Successfully Reset</h2>
            <p>Hello ${user.firstName},</p>
            <p>Your password has been successfully reset for your Expense Tracker account.</p>
            
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #155724;">
                <strong>Account Security Confirmation</strong><br>
                Email: ${user.email}<br>
                Date: ${new Date().toLocaleString('en-US', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}
              </p>
            </div>
            
            <p>You can now log in to your account using your new password.</p>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>⚠️ Didn't make this change?</strong><br>
                If you did not reset your password, your account may be compromised. Please contact our support team immediately and secure your account.
              </p>
            </div>
            
            <p style="margin-top: 30px;">Best regards,<br>The Expense Tracker Team</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #888;">
              This is an automated security notification. For your protection, we send this email whenever your password is changed.
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error("Error sending password reset confirmation email:", emailError);
      // Don't fail the password reset if email fails
    }

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

// Update Profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {firstName, lastName, email, currentPassword } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Require current password for any profile update 
    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is required to update profile"
      });
    }

    // Verify current password
    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Track what changed for notification email
    const changes = [];

    // Update first name
    if (firstName && firstName !== user.firstName) {
      if (firstName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "First name must be at least 2 characters long"
        });
      }
      user.firstName = firstName.trim();
      changes.push("First name");
    }

    // Update last name
    if (lastName && lastName !== user.lastName) {
      if (lastName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Last name must be at least 2 characters long"
        });
      }
      user.lastName = lastName.trim();
      changes.push("Last name");
    }

    // Update email (two-step verification process)
    if (email && email !== user.email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format"
        });
      }

       // Check if email already exists
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already in use"
        });
      }

      // Generate tokens for two-step verification
      const currentEmailToken = crypto.randomBytes(32).toString("hex");
      const newEmailToken = crypto.randomBytes(32).toString("hex");
      const tokenExpires = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutes

      // Store email change request
      user.emailChangeRequest = {
        newEmail: email,
        currentEmailToken: currentEmailToken,
        newEmailToken: newEmailToken,
        currentEmailVerified: false,
        newEmailVerified: false,
        expiresAt: tokenExpires
      };

      // Send verification to CURRENT email first (prove it's really them)
      try {
        const transporter = createTransporter();
        const currentEmailVerifyUrl = `${process.env.BASE_URL}/user/verify-email-change/current?token=${currentEmailToken}`;

        const currentEmailOptions = {
          from: `Expense Tracker <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: "Confirm Email Change Request",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #ffc107;">⚠️ Email Change Request</h2>
              <p>Hello ${user.firstName},</p>
              <p>You requested to change your email address from <strong>${user.email}</strong> to <strong>${email}</strong>.</p>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #856404;">
                  <strong>Action Required:</strong><br>
                  To proceed with this change, you must verify that you have access to this current email address.
                </p>
              </div>

              <p><strong>Step 1 of 2:</strong> Click the button below to verify your current email:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${currentEmailVerifyUrl}" 
                   style="background-color: #4B0082; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Verify Current Email
                </a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
                ${currentEmailVerifyUrl}
              </p>
              
              <p style="color: #d9534f; font-weight: bold;">⚠️ This link will expire in 30 minutes.</p>
              
              <p><strong>What happens next?</strong></p>
              <ol style="color: #555;">
                <li>After you verify this email, we'll send a verification link to your new email (${email})</li>
                <li>Once you verify the new email, the change will be complete</li>
                <li>You'll then log in using your new email address</li>
              </ol>

              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #856404;">
                  <strong>⚠️ Didn't request this?</strong><br>
                  If you did not make this request, please ignore this email and change your password immediately. Your email will NOT be changed unless you click the verification link.
                </p>
              </div>
              
              <p style="margin-top: 30px;">Best regards,<br>The Expense Tracker Team</p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              <p style="font-size: 12px; color: #888;">
                Date: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </div>
          `
        };

        await transporter.sendMail(currentEmailOptions);
        
        changes.push("Email change initiated - check your current email");
      } catch (emailError) {
        console.error("Error sending verification email:", emailError);
        return res.status(500).json({
          success: false,
          message: "Error sending verification email"
        });
      }
    }

    // Save changes
    if (changes.length > 0) {
      await user.save();

      // Send profile update confirmation email (only if not email change)
      if (!changes.includes("Email change initiated - check your current email")) {
        try {
          const transporter = createTransporter();
          
          const mailOptions = {
            from: `Expense Tracker <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Profile Updated Successfully",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #28a745;">✓ Profile Updated Successfully</h2>
                <p>Hello ${user.firstName},</p>
                <p>Your profile has been updated successfully.</p>
                
                <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; color: #155724;">
                    <strong>Changes Made:</strong><br>
                    ${changes.join(', ')}<br><br>
                    <strong>Date:</strong> ${new Date().toLocaleString('en-US', { 
                      dateStyle: 'full', 
                      timeStyle: 'short' 
                    })}
                  </p>
                </div>
                
                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; color: #856404;">
                    <strong>⚠️ Didn't make this change?</strong><br>
                    If you did not update your profile, please contact our support team immediately and secure your account.
                  </p>
                </div>
                
                <p style="margin-top: 30px;">Best regards,<br>The Expense Tracker Team</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #888;">
                  This is an automated security notification sent whenever your profile is updated.
                </p>
              </div>
            `
          };

          await transporter.sendMail(mailOptions);
        } catch (emailError) {
          console.error("Error sending profile update email:", emailError);
          // Don't fail the update if email fails
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
          ...(user.emailChangeRequest && { 
            emailChangeInProgress: true,
            newEmailPending: user.emailChangeRequest.newEmail 
          })
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "No changes detected"
      });
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

// Verify Current Email
const verifyCurrentEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required"
      });
    }

    // Find user with valid token
    const user = await User.findOne({
      'emailChangeRequest.currentEmailToken': token,
      'emailChangeRequest.expiresAt': { $gt: new Date() }
    }).select('+emailChangeRequest.newEmailToken');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token"
      });
    }

    // Mark current email as verified
    user.emailChangeRequest.currentEmailVerified = true;
    await user.save();

    // Now send verification to NEW email
    try {
      const transporter = createTransporter();
      const newEmailVerifyUrl = `${process.env.BASE_URL}/user/verify-email-change/new?token=${user.emailChangeRequest.newEmailToken}`;

      const newEmailOptions = {
        from: `Expense Tracker <${process.env.EMAIL_USER}>`,
        to: user.emailChangeRequest.newEmail,
        subject: "Verify Your New Email Address",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4B0082;">Verify Your New Email Address</h2>
            <p>Hello ${user.firstName},</p>
            <p>You're almost done! This is the final step to change your email address.</p>
            
            <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #0c5460;">
                <strong>Email Change Request:</strong><br>
                From: ${user.email}<br>
                To: ${user.emailChangeRequest.newEmail}
              </p>
            </div>

            <p><strong>Step 2 of 2:</strong> Click the button below to complete the email change:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${newEmailVerifyUrl}" 
                 style="background-color: #28a745; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Complete Email Change
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
              ${newEmailVerifyUrl}
            </p>
            
            <p style="color: #d9534f; font-weight: bold;">⚠️ This link will expire in 30 minutes.</p>
            
            <p><strong>What happens after verification?</strong></p>
            <ul style="color: #555;">
              <li>Your email will be changed to this address</li>
              <li>You'll log in using this new email</li>
              <li>All future notifications will come here</li>
            </ul>

            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>⚠️ Didn't request this?</strong><br>
                If you did not request this email change, do not click the link. Contact support immediately.
              </p>
            </div>
            
            <p style="margin-top: 30px;">Best regards,<br>The Expense Tracker Team</p>
          </div>
        `
      };

      await transporter.sendMail(newEmailOptions);
    } catch (emailError) {
      console.error("Error sending new email verification:", emailError);
      return res.status(500).json({
        success: false,
        message: "Error sending verification to new email"
      });
    }

    res.status(200).json({
      success: true,
      message: "Current email verified! Please check your new email to complete the change."
    });
  } catch (error) {
    console.error("Error verifying current email:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

// Verify New Email
const verifyNewEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required"
      });
    }

    // Find user with valid token and both verifications
    const user = await User.findOne({
      'emailChangeRequest.newEmailToken': token,
      'emailChangeRequest.currentEmailVerified': true,
      'emailChangeRequest.expiresAt': { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token, or current email not verified yet"
      });
    }

    // Store old email for notifications
    const oldEmail = user.email;
    const newEmail = user.emailChangeRequest.newEmail;

    // Update email and clear change request
    user.email = newEmail;
    user.emailChangeRequest = undefined;
    await user.save();

    // Send confirmation emails to both addresses
    try {
      const transporter = createTransporter();
      
      // Email to NEW address (success)
      const newEmailConfirmation = {
        from: `Expense Tracker <${process.env.EMAIL_USER}>`,
        to: newEmail,
        subject: "Email Successfully Changed",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #28a745;">✓ Email Successfully Changed</h2>
            <p>Hello ${user.firstName},</p>
            <p>Your email address has been successfully updated!</p>
            
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #155724;">
                <strong>Account Details:</strong><br>
                Previous Email: ${oldEmail}<br>
                New Email: ${newEmail}<br>
                Date: ${new Date().toLocaleString('en-US', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}
              </p>
            </div>
            
            <p><strong>Important:</strong> Use this email address (<strong>${newEmail}</strong>) for all future logins.</p>
            
            <p style="margin-top: 30px;">Best regards,<br>The Expense Tracker Team</p>
          </div>
        `
      };

      await transporter.sendMail(newEmailConfirmation);

      // Email to OLD address (notification)
      const oldEmailNotification = {
        from: `Expense Tracker <${process.env.EMAIL_USER}>`,
        to: oldEmail,
        subject: "Email Address Changed",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #28a745;">Email Address Changed</h2>
            <p>Hello ${user.firstName},</p>
            <p>This is to confirm that your account email has been successfully changed.</p>
            
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #155724;">
                <strong>Change Details:</strong><br>
                Previous Email: ${oldEmail}<br>
                New Email: ${newEmail}<br>
                Date: ${new Date().toLocaleString('en-US', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}
              </p>
            </div>

            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>⚠️ Security Alert:</strong><br>
                If you did not authorize this change, please contact our support team immediately. Your account may be compromised.
              </p>
            </div>
            
            <p><strong>This is the last email you will receive at this address.</strong></p>
            <p>All future communications will be sent to: ${newEmail}</p>
            
            <p style="margin-top: 30px;">Best regards,<br>The Expense Tracker Team</p>
          </div>
        `
      };

      await transporter.sendMail(oldEmailNotification);
    } catch (emailError) {
      console.error("Error sending confirmation emails:", emailError);
      // Don't fail the change if emails fail
    }

    res.status(200).json({
      success: true,
      message: "Email successfully changed! Please log in with your new email address.",
      newEmail: newEmail
    });
  } catch (error) {
    console.error("Error verifying new email:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

// Change Password (different from reset - requires current password)
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long"
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one lowercase letter, one uppercase letter, and one number"
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match"
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify current password
    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password"
      });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Send password change confirmation email
    try {
      const transporter = createTransporter();
      
      const mailOptions = {
        from: `Expense Tracker <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Password Changed Successfully",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #28a745;">✓ Password Changed Successfully</h2>
            <p>Hello ${user.firstName},</p>
            <p>Your password has been changed successfully.</p>
            
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #155724;">
                <strong>Security Confirmation</strong><br>
                Email: ${user.email}<br>
                Date: ${new Date().toLocaleString('en-US', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}
              </p>
            </div>
            
            <p>You can now use your new password to log in to your account.</p>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>⚠️ Didn't make this change?</strong><br>
                If you did not change your password, your account may be compromised. Please contact our support team immediately.
              </p>
            </div>
            
            <p style="margin-top: 30px;">Best regards,<br>The Expense Tracker Team</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #888;">
              This is an automated security notification sent whenever your password is changed.
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error("Error sending password change email:", emailError);
      // Don't fail the password change if email fails
    }

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

// Get Current User Profile
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Clean up expired requests
    if (user.cleanupExpiredEmailChange()) {
      await user.save();
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Email change status (if in progress)
        ...(user.emailChangeRequest && user.hasEmailChangeInProgress() && {
          emailChangeInProgress: true,
          newEmailPending: user.emailChangeRequest.newEmail,
          currentEmailVerified: user.emailChangeRequest.currentEmailVerified
        })
      }
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
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
  getCurrentUser
};