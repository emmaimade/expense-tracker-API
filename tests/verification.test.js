import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupApp, createUser, auth, sentEmails, setEmailReply, PASSWORD } from "./helpers.js";
import { generateToken } from "../utils/tokens.js";

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.close(); });
beforeEach(() => {
  sentEmails.length = 0;
  setEmailReply(201, { messageId: "<ok@brevo>" });
});

const users = () => ctx.db.collection("users");
const verify = (token) => ctx.api.post("/user/verify-email").send({ token });

/** Pull the raw token out of the most recent confirmation email. */
const tokenFromLastEmail = () => {
  const match = sentEmails.at(-1).body.htmlContent.match(/verify-email\?token=([a-f0-9]{64})/);
  assert.ok(match, "confirmation email contains a verify link");
  return match[1];
};

describe("sign-up", () => {
  it("creates an unverified user and emails a confirmation link", async () => {
    const { email, user } = await createUser(ctx.api);
    assert.equal(user.emailVerified, false);

    const mail = sentEmails.at(-1).body;
    assert.equal(mail.subject, "Confirm your SpendWise email");
    assert.equal(mail.to[0].email, email);
    assert.match(mail.htmlContent, /https:\/\/spendwise\.example\/verify-email\?token=[a-f0-9]{64}/);

    const doc = await users().findOne({ email });
    assert.match(doc.emailVerificationToken, /^[a-f0-9]{64}$/, "token stored hashed");
    assert.notEqual(doc.emailVerificationToken, tokenFromLastEmail(), "raw token is never stored");
    assert.ok(doc.emailVerificationExpires > new Date(Date.now() + 23 * 3600 * 1000), "valid for ~24h");
  });

  it("still creates the account when the confirmation email fails", async () => {
    setEmailReply(401, { message: "Key not found" });
    const res = await ctx.api.post("/user/register").send({
      firstName: "Bob", lastName: "Test", email: `fail-${Date.now()}@test.io`,
      password: PASSWORD, confirmPassword: PASSWORD, currency: "USD",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.emailVerified, false);
  });
});

describe("POST /user/verify-email", () => {
  it("verifies the user, clears the token and sends the welcome email", async () => {
    const { email, token: jwt } = await createUser(ctx.api);
    const raw = tokenFromLastEmail();

    const res = await verify(raw);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.emailVerified, true);
    assert.equal(sentEmails.at(-1).body.subject, "Welcome to SpendWise!");

    const doc = await users().findOne({ email });
    assert.equal(doc.emailVerified, true);
    assert.equal(doc.emailVerificationToken, undefined);

    const me = await ctx.api.get("/user/me").set(auth(jwt));
    assert.equal(me.body.user.emailVerified, true);

    assert.equal((await verify(raw)).status, 400, "a link can only be used once");
  });

  it("rejects the stored hash, expired tokens, and missing or non-string tokens", async () => {
    const { email } = await createUser(ctx.api);
    const doc = await users().findOne({ email });
    assert.equal((await verify(doc.emailVerificationToken)).status, 400, "hash from the database must not work");

    const expired = generateToken();
    await users().updateOne({ email }, { $set: { emailVerificationToken: expired.hash, emailVerificationExpires: new Date(Date.now() - 1000) } });
    assert.equal((await verify(expired.raw)).status, 400);

    assert.equal((await ctx.api.post("/user/verify-email").send({})).status, 400);
    assert.equal((await verify(["a", "b"])).status, 400);
    assert.equal((await verify({ $ne: null })).status, 400);
  });
});

describe("POST /user/resend-verification", () => {
  it("sends a new link and invalidates the old one", async () => {
    const { token: jwt } = await createUser(ctx.api);
    const oldRaw = tokenFromLastEmail();

    const res = await ctx.api.post("/user/resend-verification").set(auth(jwt));
    assert.equal(res.status, 200);
    const newRaw = tokenFromLastEmail();
    assert.notEqual(newRaw, oldRaw);

    assert.equal((await verify(oldRaw)).status, 400, "old link no longer works");
    assert.equal((await verify(newRaw)).status, 200);
  });

  it("refuses when already verified", async () => {
    const { token: jwt } = await createUser(ctx.api);
    await verify(tokenFromLastEmail());
    const res = await ctx.api.post("/user/resend-verification").set(auth(jwt));
    assert.equal(res.status, 400);
  });

  it("requires sign-in", async () => {
    const res = await ctx.api.post("/user/resend-verification");
    assert.equal(res.status, 401);
  });

  it("reports a send failure", async () => {
    const { token: jwt } = await createUser(ctx.api);
    setEmailReply(401, { message: "Key not found" });
    const res = await ctx.api.post("/user/resend-verification").set(auth(jwt));
    assert.equal(res.status, 500);
  });
});

describe("emails to unverified addresses", () => {
  it("skips the password-changed notification until the email is confirmed", async () => {
    const { token: jwt } = await createUser(ctx.api);
    sentEmails.length = 0;
    await ctx.api.put("/user/change-password").set(auth(jwt))
      .send({ currentPassword: PASSWORD, newPassword: "Str0ngerPass", confirmNewPassword: "Str0ngerPass" });
    assert.equal(sentEmails.length, 0);
  });

  it("sends it once the email is confirmed", async () => {
    const { token: jwt } = await createUser(ctx.api);
    await verify(tokenFromLastEmail());
    sentEmails.length = 0;
    await ctx.api.put("/user/change-password").set(auth(jwt))
      .send({ currentPassword: PASSWORD, newPassword: "Str0ngerPass", confirmNewPassword: "Str0ngerPass" });
    assert.equal(sentEmails.at(-1)?.body.subject, "Password Changed Successfully");
  });

  it("still allows password reset, and completing it verifies the email", async () => {
    const { email } = await createUser(ctx.api);
    const res = await ctx.api.post("/user/forgot-password").send({ email });
    assert.equal(res.status, 200);
    const resetRaw = sentEmails.at(-1).body.htmlContent.match(/reset-password\?token=([a-f0-9]{64})/)[1];

    const reset = await ctx.api.post(`/user/reset-password?token=${resetRaw}`).send({ password: "NewPassw0rd", confirmPassword: "NewPassw0rd" });
    assert.equal(reset.status, 200);
    assert.equal((await users().findOne({ email })).emailVerified, true);
  });
});

describe("existing accounts", () => {
  it("treats users created before verification existed as verified", async () => {
    const { email } = await createUser(ctx.api);
    // Simulate a pre-existing document that has no emailVerified field at all
    await users().updateOne({ email }, { $unset: { emailVerified: "", emailVerificationToken: "", emailVerificationExpires: "" } });

    const login = await ctx.api.post("/user/login").send({ email, password: PASSWORD });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.emailVerified, true);
  });
});
