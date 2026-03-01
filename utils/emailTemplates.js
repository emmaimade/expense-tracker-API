const LOGO_URL = 'https://res.cloudinary.com/dnvodbhr6/image/upload/v1772098072/logo_csro7g.png';

const emailHeader = () => `
  <div style="text-align: center; padding: 32px 0 24px; background: #ffffff;">
    <img
      src="${LOGO_URL}"
      alt="SpendWise"
      width="160"
      style="display: block; margin: 0 auto; height: auto; border: 0;"
    />
  </div>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 24px 0;" />
`;

const emailFooter = () => `
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 20px 0;" />
  <div style="text-align: center; padding-bottom: 24px;">
    <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">
      © ${new Date().getFullYear()} SpendWise. All rights reserved.
    </p>
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">
      This is an automated message — please do not reply directly to this email.
    </p>
  </div>
`;

const emailWrapper = (content) => `
  <div style="background-color: #f9fafb; padding: 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      ${emailHeader()}
      <div style="padding: 0 32px 8px;">
        ${content}
      </div>
      ${emailFooter()}
    </div>
  </div>
`;

// ── Email Templates ──────────────────────────────────────────────

export const welcomeEmail = ({ firstName, email, userCurrency, currencySymbol }) =>
  emailWrapper(`
    <h2 style="color: #111827; font-size: 20px; margin: 0 0 12px;">Welcome to SpendWise, ${firstName}! 🎉</h2>
    <p style="color: #4b5563; line-height: 1.6;">Thank you for creating an account. You're all set to start tracking your expenses.</p>

    <div style="background:#f3f4f6; padding:16px; border-radius:8px; margin:20px 0;">
      <h3 style="margin:0 0 10px; color:#374151; font-size:15px;">Your Account Settings</h3>
      <p style="margin:4px 0; color:#4b5563; font-size:14px;"><strong>Email:</strong> ${email}</p>
      <p style="margin:4px 0; color:#4b5563; font-size:14px;"><strong>Currency:</strong> ${userCurrency} (${currencySymbol})</p>
    </div>

    <div style="background:#ecfdf5; border-left:4px solid #10b981; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
      <h3 style="margin:0 0 10px; color:#065f46; font-size:15px;">Getting Started</h3>
      <ul style="color:#047857; font-size:14px; margin:0; padding-left:18px; line-height:1.8;">
        <li>Track your expenses in ${userCurrency}</li>
        <li>Set up budgets and categories</li>
        <li>View insightful reports and analytics</li>
        <li>Change your currency anytime in Settings</li>
      </ul>
    </div>

    <p style="color:#4b5563; line-height:1.6;">If you have any questions, feel free to reach out to our support team.</p>
    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);

export const forgotPasswordEmail = ({ firstName, resetUrl }) =>
  emailWrapper(`
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">Password Reset Request</h2>
    <p style="color:#4b5563; line-height:1.6;">Hello ${firstName},</p>
    <p style="color:#4b5563; line-height:1.6;">You requested a password reset for your SpendWise account. Click the button below to reset your password:</p>

    <div style="text-align:center; margin:32px 0;">
      <a href="${resetUrl}"
         style="background:linear-gradient(135deg,#3b82f6,#6366f1); color:white; padding:14px 36px;
                text-decoration:none; border-radius:8px; display:inline-block; font-weight:700; font-size:15px;">
        Reset Password
      </a>
    </div>

    <p style="color:#6b7280; font-size:13px;">Or copy and paste this link into your browser:</p>
    <p style="background:#f3f4f6; padding:12px; border-radius:6px; word-break:break-all; font-size:13px; color:#4b5563;">${resetUrl}</p>

    <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#b91c1c; font-size:14px;">⚠️ This link will expire in <strong>15 minutes</strong>.</p>
    </div>

    <p style="color:#4b5563; font-size:14px; line-height:1.6;">If you didn't request this, you can safely ignore this email — your password will remain unchanged.</p>
    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);

export const resetPasswordConfirmEmail = ({ firstName, email }) =>
  emailWrapper(`
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">✓ Password Successfully Reset</h2>
    <p style="color:#4b5563; line-height:1.6;">Hello ${firstName},</p>
    <p style="color:#4b5563; line-height:1.6;">Your password has been successfully reset for your SpendWise account.</p>

    <div style="background:#f0fdf4; border-left:4px solid #22c55e; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#15803d; font-size:14px; line-height:1.6;">
        <strong>Account Security Confirmation</strong><br>
        Email: ${email}<br>
        Date: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
    </div>

    <p style="color:#4b5563; line-height:1.6;">You can now log in with your new password.</p>

    <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#92400e; font-size:14px;">
        <strong>⚠️ Didn't make this change?</strong><br>
        Your account may be compromised. Please contact our support team immediately.
      </p>
    </div>

    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);

export const profileUpdatedEmail = ({ firstName, changes }) =>
  emailWrapper(`
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">✓ Profile Updated Successfully</h2>
    <p style="color:#4b5563; line-height:1.6;">Hello ${firstName},</p>
    <p style="color:#4b5563; line-height:1.6;">Your profile has been updated successfully.</p>

    <div style="background:#f0fdf4; border-left:4px solid #22c55e; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#15803d; font-size:14px; line-height:1.6;">
        <strong>Changes Made:</strong> ${changes.join(', ')}<br>
        <strong>Date:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
    </div>

    <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#92400e; font-size:14px;">
        <strong>⚠️ Didn't make this change?</strong><br>
        Please contact our support team immediately and secure your account.
      </p>
    </div>

    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);

export const emailChangeCurrentEmail = ({ firstName, currentEmail, newEmail, verifyUrl }) =>
  emailWrapper(`
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">⚠️ Email Change Request</h2>
    <p style="color:#4b5563; line-height:1.6;">Hello ${firstName},</p>
    <p style="color:#4b5563; line-height:1.6;">You requested to change your email from <strong>${currentEmail}</strong> to <strong>${newEmail}</strong>.</p>

    <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#92400e; font-size:14px;">
        <strong>Action Required:</strong> To proceed, verify that you have access to this current email address.
      </p>
    </div>

    <p style="color:#4b5563; font-size:14px;"><strong>Step 1 of 2:</strong> Click below to verify your current email:</p>

    <div style="text-align:center; margin:28px 0;">
      <a href="${verifyUrl}"
         style="background:linear-gradient(135deg,#3b82f6,#6366f1); color:white; padding:14px 36px;
                text-decoration:none; border-radius:8px; display:inline-block; font-weight:700; font-size:15px;">
        Verify Current Email
      </a>
    </div>

    <p style="color:#6b7280; font-size:13px;">Or copy and paste this link:</p>
    <p style="background:#f3f4f6; padding:12px; border-radius:6px; word-break:break-all; font-size:13px; color:#4b5563;">${verifyUrl}</p>

    <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#b91c1c; font-size:14px;">⚠️ This link expires in <strong>30 minutes</strong>.</p>
    </div>

    <p style="color:#4b5563; font-size:14px; line-height:1.8;"><strong>What happens next?</strong></p>
    <ol style="color:#4b5563; font-size:14px; line-height:1.8; padding-left:18px;">
      <li>After verifying, we'll send a link to your new email (${newEmail})</li>
      <li>Once you verify the new email, the change is complete</li>
      <li>You'll then log in using your new email address</li>
    </ol>

    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);

export const emailChangeNewEmail = ({ firstName, currentEmail, newEmail, verifyUrl }) =>
  emailWrapper(`
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">Verify Your New Email Address</h2>
    <p style="color:#4b5563; line-height:1.6;">Hello ${firstName},</p>
    <p style="color:#4b5563; line-height:1.6;">You're almost done! This is the final step to change your email address.</p>

    <div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#1e40af; font-size:14px; line-height:1.6;">
        <strong>Email Change Request:</strong><br>
        From: ${currentEmail}<br>
        To: ${newEmail}
      </p>
    </div>

    <p style="color:#4b5563; font-size:14px;"><strong>Step 2 of 2:</strong> Click below to complete the email change:</p>

    <div style="text-align:center; margin:28px 0;">
      <a href="${verifyUrl}"
         style="background:linear-gradient(135deg,#10b981,#059669); color:white; padding:14px 36px;
                text-decoration:none; border-radius:8px; display:inline-block; font-weight:700; font-size:15px;">
        Complete Email Change
      </a>
    </div>

    <p style="color:#6b7280; font-size:13px;">Or copy and paste this link:</p>
    <p style="background:#f3f4f6; padding:12px; border-radius:6px; word-break:break-all; font-size:13px; color:#4b5563;">${verifyUrl}</p>

    <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#b91c1c; font-size:14px;">⚠️ This link expires in <strong>30 minutes</strong>.</p>
    </div>

    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);

export const emailChangedConfirmEmail = ({ firstName, oldEmail, newEmail }) =>
  emailWrapper(`
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">✓ Email Successfully Changed</h2>
    <p style="color:#4b5563; line-height:1.6;">Hello ${firstName},</p>
    <p style="color:#4b5563; line-height:1.6;">Your email address has been successfully updated!</p>

    <div style="background:#f0fdf4; border-left:4px solid #22c55e; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#15803d; font-size:14px; line-height:1.6;">
        <strong>Account Details:</strong><br>
        Previous Email: ${oldEmail}<br>
        New Email: ${newEmail}<br>
        Date: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
    </div>

    <p style="color:#4b5563; line-height:1.6;"><strong>Important:</strong> Use <strong>${newEmail}</strong> for all future logins.</p>

    <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#92400e; font-size:14px;">
        <strong>⚠️ Didn't authorize this?</strong><br>
        Contact our support team immediately — your account may be compromised.
      </p>
    </div>

    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);

export const emailChangedOldAddressNotification = ({ firstName, oldEmail, newEmail }) =>
  emailWrapper(`
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">Email Address Changed</h2>
    <p style="color:#4b5563; line-height:1.6;">Hello ${firstName},</p>
    <p style="color:#4b5563; line-height:1.6;">This confirms your account email has been successfully changed.</p>

    <div style="background:#f0fdf4; border-left:4px solid #22c55e; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#15803d; font-size:14px; line-height:1.6;">
        <strong>Change Details:</strong><br>
        Previous Email: ${oldEmail}<br>
        New Email: ${newEmail}<br>
        Date: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
    </div>

    <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#92400e; font-size:14px;">
        <strong>⚠️ Security Alert:</strong><br>
        If you did not authorize this, contact our support team immediately.
      </p>
    </div>

    <p style="color:#4b5563; font-size:14px;"><strong>This is the last email you will receive at this address.</strong><br>
    All future communications will go to: ${newEmail}</p>

    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);

export const passwordChangedEmail = ({ firstName, email }) =>
  emailWrapper(`
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">✓ Password Changed Successfully</h2>
    <p style="color:#4b5563; line-height:1.6;">Hello ${firstName},</p>
    <p style="color:#4b5563; line-height:1.6;">Your password has been changed successfully.</p>

    <div style="background:#f0fdf4; border-left:4px solid #22c55e; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#15803d; font-size:14px; line-height:1.6;">
        <strong>Security Confirmation</strong><br>
        Email: ${email}<br>
        Date: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
    </div>

    <p style="color:#4b5563; line-height:1.6;">You can now use your new password to log in.</p>

    <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#92400e; font-size:14px;">
        <strong>⚠️ Didn't make this change?</strong><br>
        Your account may be compromised. Please contact our support team immediately.
      </p>
    </div>

    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);

export const currencyUpdatedEmail = ({ firstName, oldCurrency, newCurrency, oldSymbol, newSymbol, rate, expensesConverted, budgetsConverted, shouldConvert }) =>
  emailWrapper(`
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">✓ Currency Successfully Updated</h2>
    <p style="color:#4b5563; line-height:1.6;">Hello ${firstName},</p>
    <p style="color:#4b5563; line-height:1.6;">Your preferred currency has been successfully updated.</p>

    <div style="background:#f0fdf4; border-left:4px solid #22c55e; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#15803d; font-size:14px; line-height:1.6;">
        <strong>Currency Change Summary</strong><br>
        Previous: ${oldCurrency} (${oldSymbol})<br>
        New: ${newCurrency} (${newSymbol})<br>
        Exchange Rate: ${rate.toFixed(4)}<br>
        Date: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
    </div>

    ${shouldConvert ? `
    <div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#1e40af; font-size:14px; line-height:1.8;">
        <strong>Data Conversion Complete</strong><br>
        ✓ ${expensesConverted} expenses converted<br>
        ✓ ${budgetsConverted} budgets converted<br>
        ✓ Original amounts preserved for reference
      </p>
    </div>
    ` : ''}

    <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:14px; border-radius:0 8px 8px 0; margin:20px 0;">
      <p style="margin:0; color:#92400e; font-size:14px;">
        <strong>⚠️ Security Notice</strong><br>
        If you did not make this change, please contact support immediately.
      </p>
    </div>

    <p style="color:#4b5563; margin-top:24px;">Best regards,<br><strong>The SpendWise Team</strong></p>
  `);