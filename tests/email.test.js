import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupApp, createUser, sentEmails, setEmailReply, tokenRequests, setTokenReply } from "./helpers.js";
import sendEmail, { parseAddress, buildMimeMessage, resetGmailTokenCache } from "../utils/email.js";

/** Decode the base64url `raw` MIME message the Gmail API receives. */
const decodeRaw = (raw) => Buffer.from(raw, "base64url").toString("utf8");

const message = { to: "user@example.com", subject: "Hello", html: "<p>Hi</p>" };

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.close(); });

beforeEach(() => {
  sentEmails.length = 0;
  process.env.EMAIL_PROVIDER = "brevo";
  process.env.EMAIL_FROM = "SpendWise <sender@example.com>";
  setEmailReply(201, { messageId: "<ok@brevo>" });
});

describe("parseAddress", () => {
  it("splits 'Name <email>'", () => {
    assert.deepEqual(parseAddress("SpendWise <me@gmail.com>"), { name: "SpendWise", email: "me@gmail.com" });
  });

  it("accepts a bare address", () => {
    assert.deepEqual(parseAddress(" me@gmail.com "), { email: "me@gmail.com" });
  });
});

describe("Brevo provider", () => {
  it("sends the expected request", async () => {
    await sendEmail(message);
    const [call] = sentEmails;
    assert.equal(call.url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(call.headers["api-key"], "test-brevo-key");
    assert.deepEqual(call.body.sender, { name: "SpendWise", email: "sender@example.com" });
    assert.deepEqual(call.body.to, [{ email: message.to }]);
    assert.equal(call.body.subject, message.subject);
    assert.equal(call.body.htmlContent, message.html);
  });

  it("throws with Brevo's message on failure", async () => {
    setEmailReply(401, { code: "unauthorized", message: "Key not found" });
    await assert.rejects(sendEmail(message), /Brevo failed.*401.*Key not found/);
  });
});

describe("Resend provider", () => {
  it("uses EMAIL_FROM", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.EMAIL_FROM = "SpendWise <noreply@mydomain.com>";
    setEmailReply(200, { id: "email_123" });
    await sendEmail(message);
    assert.match(sentEmails[0].url, /^https:\/\/api\.resend\.com\/emails/);
    assert.equal(sentEmails[0].body.from, "SpendWise <noreply@mydomain.com>");
  });

  it("throws when Resend returns an error (previously ignored)", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    setEmailReply(403, { statusCode: 403, name: "validation_error", message: "You can only send testing emails to your own email address" });
    await assert.rejects(sendEmail(message), /Resend failed.*own email address/);
  });
});

describe("Gmail provider", () => {
  beforeEach(() => {
    process.env.EMAIL_PROVIDER = "gmail";
    process.env.EMAIL_FROM = "SpendWise <sender@gmail.com>";
    Object.assign(process.env, { GMAIL_CLIENT_ID: "gid", GMAIL_CLIENT_SECRET: "gsecret", GMAIL_REFRESH_TOKEN: "grefresh" });
    resetGmailTokenCache();
    tokenRequests.length = 0;
    setTokenReply(200, { access_token: "test-access-token", expires_in: 3600 });
    setEmailReply(200, { id: "gmail-msg-1" });
  });

  it("exchanges the refresh token, then sends a MIME message", async () => {
    await sendEmail(message);

    assert.deepEqual(tokenRequests[0], {
      client_id: "gid", client_secret: "gsecret", refresh_token: "grefresh", grant_type: "refresh_token",
    });
    const [call] = sentEmails;
    assert.equal(call.url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    assert.equal(call.headers.authorization, "Bearer test-access-token");

    const mime = decodeRaw(call.body.raw);
    assert.match(mime, /^From: SpendWise <sender@gmail\.com>\r\n/);
    assert.match(mime, /\r\nTo: user@example\.com\r\n/);
    assert.match(mime, /\r\nSubject: Hello\r\n/);
    assert.match(mime, /\r\nContent-Type: text\/html; charset=UTF-8\r\n/);
    const body = mime.split("\r\n\r\n")[1].replace(/\r\n/g, "");
    assert.equal(Buffer.from(body, "base64").toString("utf8"), message.html);
  });

  it("reuses the access token until it expires", async () => {
    await sendEmail(message);
    await sendEmail(message);
    assert.equal(tokenRequests.length, 1);
    assert.equal(sentEmails.length, 2);
  });

  it("reports an expired or revoked refresh token clearly", async () => {
    setTokenReply(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
    await assert.rejects(sendEmail(message), /Gmail authorization failed \(400\): Token has been expired or revoked/);
    assert.equal(sentEmails.length, 0);
  });

  it("throws with Gmail's message when sending fails", async () => {
    setEmailReply(403, { error: { code: 403, message: "Daily sending quota exceeded" } });
    await assert.rejects(sendEmail(message), /Gmail failed to send email \(403\): Daily sending quota exceeded/);
  });

  it("encodes non-English subjects and display names", () => {
    const mime = buildMimeMessage({ from: "Dépenses <a@gmail.com>", to: "b@test.io", subject: "Résumé ✓", html: "x" });
    assert.match(mime, /^From: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <a@gmail\.com>/);
    const encodedSubject = mime.match(/Subject: =\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/)[1];
    assert.equal(Buffer.from(encodedSubject, "base64").toString("utf8"), "Résumé ✓");
  });

  it("refuses header injection through line breaks", async () => {
    await assert.rejects(
      sendEmail({ ...message, to: "victim@test.io\r\nBcc: attacker@evil.io" }),
      /Invalid email header value/
    );
    assert.equal(sentEmails.length, 0, "nothing was sent");
  });
});

describe("configuration", () => {
  it("defaults to Resend and onboarding@resend.dev when unset", async () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_FROM;
    setEmailReply(200, { id: "email_456" });
    await sendEmail(message);
    assert.match(sentEmails[0].url, /api\.resend\.com/);
    assert.equal(sentEmails[0].body.from, "SpendWise <onboarding@resend.dev>");
  });

  it("rejects an unknown provider", async () => {
    process.env.EMAIL_PROVIDER = "mailchimp";
    await assert.rejects(sendEmail(message), /Unknown EMAIL_PROVIDER "mailchimp"/);
  });
});

describe("email flows through the API", () => {
  it("sends a confirmation email (not the welcome email) on register", async () => {
    await createUser(ctx.api);
    assert.equal(sentEmails.at(-1).body.subject, "Confirm your SpendWise email");
  });

  it("sends a reset link built from FRONTEND_URL", async () => {
    const { email } = await createUser(ctx.api);
    sentEmails.length = 0;

    const res = await ctx.api.post("/user/forgot-password").send({ email });
    assert.equal(res.status, 200);
    assert.equal(sentEmails[0].body.to[0].email, email);
    assert.match(sentEmails[0].body.htmlContent, /https:\/\/spendwise\.example\/reset-password\?token=[a-f0-9]{64}/);
  });

  it("does not reveal whether an email is registered", async () => {
    const res = await ctx.api.post("/user/forgot-password").send({ email: "nobody-here@test.io" });
    assert.equal(res.status, 200);
    assert.equal(sentEmails.length, 0);
  });

  it("reports a failed reset email instead of claiming it was sent", async () => {
    const { email } = await createUser(ctx.api);
    setEmailReply(401, { message: "Key not found" });
    const res = await ctx.api.post("/user/forgot-password").send({ email });
    assert.equal(res.status, 500);
    assert.equal(res.body.success, false);
  });

  it("still registers the user when the welcome email fails", async () => {
    setEmailReply(401, { message: "Key not found" });
    const res = await ctx.api.post("/user/register").send({
      firstName: "Bob", lastName: "Test", email: `bob-${Date.now()}@test.io`,
      password: "Passw0rd", confirmPassword: "Passw0rd", currency: "USD",
    });
    assert.equal(res.status, 201);
  });
});
