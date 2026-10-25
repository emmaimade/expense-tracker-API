import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { setupApp, createUser, defaultCategoryId, auth, sentEmails, setEmailReply, PASSWORD } from "./helpers.js";

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.close(); });
beforeEach(() => {
  sentEmails.length = 0;
  setEmailReply(201, { messageId: "<ok@brevo>" });
});

const deleteAccount = (token, body) => ctx.api.delete("/user/me").set(auth(token)).send(body);

/** Create a user who owns an expense, a budget and a custom category. */
async function userWithData() {
  const user = await createUser(ctx.api);
  const food = await defaultCategoryId(ctx.api, user.token);
  await ctx.api.post("/expense").set(auth(user.token)).send({ amount: 10, category: food, description: "Lunch", date: new Date().toISOString() });
  await ctx.api.post("/budget").set(auth(user.token)).send({ categoryId: food, amount: 100, month: 1, year: 2026 });
  await ctx.api.post("/category").set(auth(user.token)).send({ name: `Hobby ${Date.now()}` });
  return user;
}

const counts = async (userId) => {
  const id = new ctx.db.base.Types.ObjectId(userId);
  return {
    user: await ctx.db.collection("users").countDocuments({ _id: id }),
    expenses: await ctx.db.collection("expenses").countDocuments({ userId: id }),
    budgets: await ctx.db.collection("budgets").countDocuments({ userId: id }),
    categories: await ctx.db.collection("categories").countDocuments({ userId: id }),
  };
};

describe("password accounts", () => {
  it("report hasPassword: true", async () => {
    const { token, user } = await createUser(ctx.api);
    assert.equal(user.hasPassword, true);
    const me = await ctx.api.get("/user/me").set(auth(token));
    assert.equal(me.body.user.hasPassword, true);
    assert.equal(me.body.user.password, undefined, "the password itself is never returned");
  });

  it("require the password", async () => {
    const { token } = await createUser(ctx.api);
    assert.equal((await deleteAccount(token, {})).status, 400);
    assert.equal((await deleteAccount(token, { confirmation: "DELETE" })).status, 400, "typing DELETE is not enough");
    assert.equal((await deleteAccount(token, { password: "Wr0ngPassword" })).status, 401);
  });

  it("delete the user and everything they own, and nothing else", async () => {
    const victim = await userWithData();
    const bystander = await userWithData();
    const before = await counts(victim.user.id);
    assert.deepEqual(before, { user: 1, expenses: 1, budgets: 1, categories: 1 });
    const defaultsBefore = await ctx.db.collection("categories").countDocuments({ isDefault: true });

    const res = await deleteAccount(victim.token, { password: PASSWORD });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.deleted, { expenses: 1, budgets: 1, categories: 1 });

    assert.deepEqual(await counts(victim.user.id), { user: 0, expenses: 0, budgets: 0, categories: 0 });
    assert.deepEqual(await counts(bystander.user.id), { user: 1, expenses: 1, budgets: 1, categories: 1 });
    assert.equal(await ctx.db.collection("categories").countDocuments({ isDefault: true }), defaultsBefore, "default categories untouched");
  });

  it("invalidate the old token immediately", async () => {
    const { token } = await userWithData();
    const food = await defaultCategoryId(ctx.api, token);
    await deleteAccount(token, { password: PASSWORD });

    assert.equal((await ctx.api.get("/user/me").set(auth(token))).status, 401);
    const orphan = await ctx.api.post("/expense").set(auth(token)).send({ amount: 5, category: food, description: "x", date: new Date().toISOString() });
    assert.equal(orphan.status, 401, "a leftover token must not create data for a deleted account");
  });

  it("free up the email address for a new sign-up", async () => {
    const { email, token } = await createUser(ctx.api);
    await deleteAccount(token, { password: PASSWORD });
    const again = await createUser(ctx.api, { email });
    assert.equal(again.email, email);
  });
});

describe("Google-only accounts", () => {
  /** Insert a user the way the Google strategy creates one (placeholder, not a bcrypt hash). */
  async function googleUser() {
    const email = `google-${Date.now()}@test.io`;
    const { insertedId } = await ctx.db.collection("users").insertOne({
      firstName: "Gina", lastName: "Google", email, password: "GOOGLE_AUTH_abc123",
      googleId: "g-123", currency: "USD", emailVerified: true,
    });
    return { email, token: jwt.sign({ id: insertedId }, process.env.JWT_SECRET) };
  }

  it("report hasPassword: false", async () => {
    const { token } = await googleUser();
    const me = await ctx.api.get("/user/me").set(auth(token));
    assert.equal(me.body.user.hasPassword, false);
  });

  it("confirm by typing DELETE", async () => {
    const { email, token } = await googleUser();
    assert.equal((await deleteAccount(token, {})).status, 400);
    assert.equal((await deleteAccount(token, { confirmation: "delete" })).status, 400, "must match exactly");
    assert.equal((await deleteAccount(token, { password: "GOOGLE_AUTH_abc123" })).status, 400, "the placeholder is not a password");

    const res = await deleteAccount(token, { confirmation: "DELETE" });
    assert.equal(res.status, 200);
    assert.equal(await ctx.db.collection("users").countDocuments({ email }), 0);
  });
});

describe("confirmation email", () => {
  it("is sent to verified addresses", async () => {
    const { token, email } = await createUser(ctx.api);
    await ctx.db.collection("users").updateOne({ email }, { $set: { emailVerified: true } });
    sentEmails.length = 0;

    await deleteAccount(token, { password: PASSWORD });
    assert.equal(sentEmails.at(-1)?.body.subject, "Your SpendWise account has been deleted");
    assert.equal(sentEmails.at(-1)?.body.to[0].email, email);
  });

  it("is not sent to unverified addresses", async () => {
    const { token } = await createUser(ctx.api);
    sentEmails.length = 0;
    await deleteAccount(token, { password: PASSWORD });
    assert.equal(sentEmails.length, 0);
  });

  it("failing does not undo or block the deletion", async () => {
    const { token, email } = await createUser(ctx.api);
    await ctx.db.collection("users").updateOne({ email }, { $set: { emailVerified: true } });
    setEmailReply(401, { message: "Key not found" });

    const res = await deleteAccount(token, { password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(await ctx.db.collection("users").countDocuments({ email }), 0);
  });
});

it("requires sign-in", async () => {
  const res = await ctx.api.delete("/user/me").send({ password: PASSWORD });
  assert.equal(res.status, 401);
});
