import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupApp, createUser, auth, PASSWORD } from "./helpers.js";

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.close(); });

const CORE_USER_FIELDS = ["id", "firstName", "lastName", "fullName", "name", "email", "currency", "currencySymbol", "firstLoginAt", "lastLoginAt"];
const assertCoreFields = (user, label) => {
  const missing = CORE_USER_FIELDS.filter((key) => !(key in user));
  assert.deepEqual(missing, [], `${label} is missing fields`);
};

describe("user response shape", () => {
  it("is the same for register, login, /me and profile update", async () => {
    const email = `ada-${Date.now()}@test.io`;
    const reg = await ctx.api.post("/user/register").send({ firstName: "Ada", lastName: "Lovelace", email, password: PASSWORD, confirmPassword: PASSWORD, currency: "NGN" });
    assert.equal(reg.status, 201);
    assertCoreFields(reg.body.user, "register");

    const login = await ctx.api.post("/user/login").send({ email, password: PASSWORD });
    assertCoreFields(login.body.user, "login");
    assert.equal(login.body.user.name, "Ada Lovelace");
    assert.equal(login.body.user.fullName, "Ada Lovelace");
    assert.equal(login.body.user.currencySymbol, "₦");

    const token = login.body.token;
    const me = await ctx.api.get("/user/me").set(auth(token));
    assertCoreFields(me.body.user, "/me");
    assert.ok(me.body.user.createdAt);

    const profile = await ctx.api.put("/user/profile").set(auth(token)).send({ firstName: "Augusta", currentPassword: PASSWORD });
    assertCoreFields(profile.body.user, "profile update");
    assert.equal(profile.body.user.name, "Augusta Lovelace");
  });
});

describe("password rules", () => {
  const register = (password) =>
    ctx.api.post("/user/register").send({ firstName: "Aaa", lastName: "Test", email: `weak-${Date.now()}@test.io`, password, confirmPassword: password, currency: "USD" });

  it("rejects short passwords", async () => {
    const res = await register("short");
    assert.equal(res.status, 400);
    assert.match(res.body.message, /at least 6/);
  });

  it("requires upper, lower and a number", async () => {
    const res = await register("alllowercase1");
    assert.equal(res.status, 400);
    assert.match(res.body.message, /uppercase/);
  });

  it("applies the same rules when changing password", async () => {
    const { token } = await createUser(ctx.api);
    const weak = await ctx.api.put("/user/change-password").set(auth(token)).send({ currentPassword: PASSWORD, newPassword: "weak", confirmNewPassword: "weak" });
    assert.equal(weak.status, 400);

    const strong = await ctx.api.put("/user/change-password").set(auth(token)).send({ currentPassword: PASSWORD, newPassword: "Str0ngerPass", confirmNewPassword: "Str0ngerPass" });
    assert.equal(strong.status, 200);
  });
});

describe("authentication", () => {
  it("rejects requests without a token", async () => {
    const res = await ctx.api.get("/expense");
    assert.equal(res.status, 401);
  });

  it("rejects an invalid token", async () => {
    const res = await ctx.api.get("/expense").set(auth("not-a-real-token"));
    assert.equal(res.status, 403);
  });

  it("rejects a wrong password", async () => {
    const { email } = await createUser(ctx.api);
    const res = await ctx.api.post("/user/login").send({ email, password: "Wr0ngPassword" });
    assert.equal(res.status, 401);
  });
});
