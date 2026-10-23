import { Resend } from 'resend';

// Which service sends email is chosen by env vars, so switching providers
// (e.g. Brevo now, Resend once a domain is verified) needs no code change:
//   EMAIL_PROVIDER = "resend" (default) | "brevo"
//   EMAIL_FROM     = "SpendWise <sender@example.com>"
const DEFAULT_FROM = 'SpendWise <onboarding@resend.dev>';
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

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

const providers = {
  resend: sendWithResend,
  brevo: sendWithBrevo,
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
