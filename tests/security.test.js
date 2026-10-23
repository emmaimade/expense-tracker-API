import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupApp, createUser, defaultCategoryId, auth, PASSWORD } from "./helpers.js";
import { generateToken } from "../utils/tokens.js";

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.close(); });

describe("NoSQL injection", () => {
  it("rejects operator objects in the login body", async () => {
    const { email } = await createUser(ctx.api);
    const res = await ctx.api.post("/user/login").send({ email: { $ne: null }, password: PASSWORD });
    assert.equal(res.status, 400);
    assert.ok(email); // a user exists that the injection would otherwise have matched
  });

  it("rejects operator keys in the query string", async () => {
    const reset = await ctx.api.post("/user/reset-password?token[$ne]=x").send({ password: "NewPassw0rd", confirmPassword: "NewPassw0rd" });
    assert.equal(reset.status, 400);

    const verify = await ctx.api.get("/user/verify-email-change/current?token[$gt]=");
    assert.equal(verify.status, 400);
  });

  it("rejects a token passed as an array", async () => {
    const res = await ctx.api.post("/user/reset-password?token=a&token=b").send({ password: "NewPassw0rd", confirmPassword: "NewPassw0rd" });
    assert.equal(res.status, 400);
  });
});

describe("hashed reset tokens", () => {
  it("only accepts the raw emailed token, not the stored hash", async () => {
    const { email } = await createUser(ctx.api);
    const token = generateToken();
    await ctx.db.collection("users").updateOne(
      { email },
      { $set: { resetPasswordToken: token.hash, resetPasswordExpires: new Date(Date.now() + 60_000) } }
    );
    const body = { password: "NewPassw0rd", confirmPassword: "NewPassw0rd" };

    const withHash = await ctx.api.post(`/user/reset-password?token=${token.hash}`).send(body);
    assert.equal(withHash.status, 400, "a leaked database value must not work as a reset link");

    const withRaw = await ctx.api.post(`/user/reset-password?token=${token.raw}`).send(body);
    assert.equal(withRaw.status, 200);

    const login = await ctx.api.post("/user/login").send({ email, password: "NewPassw0rd" });
    assert.equal(login.status, 200);
  });

  it("stores forgot-password tokens as sha256 hashes", async () => {
    const { email } = await createUser(ctx.api);
    const res = await ctx.api.post("/user/forgot-password").send({ email });
    assert.equal(res.status, 200);

    const user = await ctx.db.collection("users").findOne({ email });
    assert.match(user.resetPasswordToken, /^[a-f0-9]{64}$/);
  });
});

describe("two-step email change", () => {
  it("stores both tokens hashed and completes with the raw tokens", async () => {
    const { email, token } = await createUser(ctx.api);
    const users = ctx.db.collection("users");
    const newEmail = `changed-${Date.now()}@test.io`;

    const start = await ctx.api.put("/user/profile").set(auth(token)).send({ email: newEmail, currentPassword: PASSWORD });
    assert.equal(start.status, 200);

    let doc = await users.findOne({ email });
    assert.match(doc.emailChangeRequest.currentEmailToken, /^[a-f0-9]{64}$/);
    assert.equal(doc.emailChangeRequest.newEmailToken, undefined, "new-email token is only created after step 1");

    // Simulate clicking the link in the current-email message
    const current = generateToken();
    await users.updateOne({ email }, { $set: { "emailChangeRequest.currentEmailToken": current.hash } });
    const step1 = await ctx.api.get(`/user/verify-email-change/current?token=${current.raw}`);
    assert.equal(step1.status, 200);

    doc = await users.findOne({ email });
    assert.match(doc.emailChangeRequest.newEmailToken, /^[a-f0-9]{64}$/);

    // Simulate clicking the link in the new-email message
    const next = generateToken();
    await users.updateOne({ email }, { $set: { "emailChangeRequest.newEmailToken": next.hash } });
    const step2 = await ctx.api.get(`/user/verify-email-change/new?token=${next.raw}`);
    assert.equal(step2.status, 200);
    assert.ok(await users.findOne({ email: newEmail }));
  });
});

describe("category ownership", () => {
  it("prevents using another user's category", async () => {
    const owner = await createUser(ctx.api);
    const other = await createUser(ctx.api);
    const privateCat = (await ctx.api.post("/category").set(auth(owner.token)).send({ name: "Owner Only" })).body.data.id;
    const food = await defaultCategoryId(ctx.api, other.token);
    const expense = { amount: 10, description: "x", date: new Date().toISOString() };

    const add = await ctx.api.post("/expense").set(auth(other.token)).send({ ...expense, category: privateCat });
    assert.equal(add.status, 404);

    const ok = await ctx.api.post("/expense").set(auth(other.token)).send({ ...expense, category: food });
    assert.equal(ok.status, 201);

    const move = await ctx.api.patch(`/expense/${ok.body.data.expense._id}`).set(auth(other.token)).send({ category: privateCat });
    assert.equal(move.status, 404);

    const exp = await ctx.api.get(`/expense/export?category=${privateCat}&fileFormat=csv`).set(auth(other.token));
    assert.equal(exp.status, 400);

    const budget = await ctx.api.post("/budget").set(auth(other.token)).send({ categoryId: privateCat, amount: 100, month: 1, year: 2026 });
    assert.equal(budget.status, 404);
  });
});

describe("HTTP hardening", () => {
  it("sets helmet security headers", async () => {
    const res = await ctx.api.get("/");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });

  it("allows FRONTEND_URL and blocks other browser origins", async () => {
    const allowed = await ctx.api.get("/").set("Origin", "https://spendwise.example");
    assert.equal(allowed.headers["access-control-allow-origin"], "https://spendwise.example");

    const blocked = await ctx.api.get("/").set("Origin", "https://evil.example");
    assert.equal(blocked.headers["access-control-allow-origin"], undefined);
  });

  it("detect-currency responds instead of crashing", async () => {
    const res = await ctx.api.get("/user/detect-currency");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
