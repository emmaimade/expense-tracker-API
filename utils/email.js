import { Resend } from 'resend';

// Which service sends email is chosen by env vars, so switching providers
// (e.g. Gmail now, Resend or Brevo once a domain is verified) needs no code change:
//   EMAIL_PROVIDER = "resend" (default) | "brevo" | "gmail"
//   EMAIL_FROM     = "SpendWise <sender@example.com>"
const DEFAULT_FROM = 'SpendWise <onboarding@resend.dev>';
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

let resend;

const getResend = () => {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

// "SpendWise <a@b.com>" -> { name: "SpendWise", email: "a@b.com" }
export const parseAddress = (address) => {
  const match = address.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || undefined, email: match[2] } : { email: address.trim() };
};

const sendWithResend = async ({ from, to, subject, html }) => {
  // The Resend SDK reports failures in `error` instead of throwing
  const { data, error } = await getResend().emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`Resend failed to send email: ${error.message || error.name}`);
  }
  return data;
};

const sendWithBrevo = async ({ from, to, subject, html }) => {
  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseAddress(from),
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Brevo failed to send email (${response.status}): ${body.message || response.statusText}`);
  }
  return body;
};

// ── Gmail API ────────────────────────────────────────────────────
// Sends from a Gmail account over HTTPS (works where SMTP ports are blocked).
// Needs GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN
// (run `npm run gmail:auth` once to get the refresh token).

let gmailToken = { value: null, expiresAt: 0 };

// Exchange the long-lived refresh token for a short-lived access token (cached)
const getGmailAccessToken = async () => {
  if (gmailToken.value && Date.now() < gmailToken.expiresAt) return gmailToken.value;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    // invalid_grant usually means the refresh token expired or was revoked
    throw new Error(`Gmail authorization failed (${response.status}): ${body.error_description || body.error || response.statusText}`);
  }

  // Refresh a minute early so a token never expires mid-request
  gmailToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return gmailToken.value;
};

// Line breaks in a header value would let it add extra headers (e.g. Bcc)
const headerValue = (value) => {
  if (/[\r\n]/.test(value)) throw new Error('Invalid email header value');
  return value;
};

// RFC 2047 encoding so non-ASCII subjects and names survive
const encodeHeader = (value) =>
  /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;

// Build a MIME message from parts we control: plain headers + base64 HTML body
export const buildMimeMessage = ({ from, to, subject, html }) => {
  const { name, email } = parseAddress(headerValue(from));
  const body = Buffer.from(html, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  return [
    `From: ${name ? `${encodeHeader(name)} <${email}>` : email}`,
    `To: ${headerValue(to)}`,
    `Subject: ${encodeHeader(headerValue(subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
};

const sendWithGmail = async ({ from, to, subject, html }) => {
  const accessToken = await getGmailAccessToken();
  const raw = Buffer.from(buildMimeMessage({ from, to, subject, html })).toString('base64url');

  const response = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Gmail failed to send email (${response.status}): ${body.error?.message || response.statusText}`);
  }
  return body;
};

// For tests: forget the cached access token
export const resetGmailTokenCache = () => {
  gmailToken = { value: null, expiresAt: 0 };
};

const providers = {
  resend: sendWithResend,
  brevo: sendWithBrevo,
  gmail: sendWithGmail,
};

const sendEmail = async ({ to, subject, html }) => {
  const providerName = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
  const send = providers[providerName];
  if (!send) {
    throw new Error(`Unknown EMAIL_PROVIDER "${providerName}". Use one of: ${Object.keys(providers).join(', ')}`);
  }

  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  return send({ from, to, subject, html });
};

export default sendEmail;
