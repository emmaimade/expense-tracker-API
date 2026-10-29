import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { setupApp, createUser, auth, PASSWORD } from "./helpers.js";
import { callbackRedirectUrl } from "../routes/auth.js";

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.close(); });

const sessions = () => ctx.db.collection("sessions");

/** Parse Set-Cookie headers into { name: { value, attrs } }. */
const parseCookies = (res) =>
  Object.fromEntries((res.headers["set-cookie"] || []).map((line) => {
    const [pair, ...attrs] = line.split(/;\s*/);
    const [name, value] = pair.split("=");
    return [name, { value, attrs: attrs.map((a) => a.toLowerCase()) }];
  }));

/** A browser-like client (keeps cookies) that is signed in as a new user. */
async function signedInBrowser() {
  const { email } = await createUser(ctx.api);
  const browser = request.agent(ctx.app);
  const res = await browser.post("/user/login").send({ email, password: PASSWORD });
  assert.equal(res.status, 200);
  return { browser, email, cookies: parseCookies(res), userId: res.body.user.id };
}

describe("sign-in cookies", () => {
  it("sets httpOnly, SameSite=Lax access and refresh cookies", async () => {
    const { cookies } = await signedInBrowser();
    for (const name of ["sw_access", "sw_refresh"]) {
      assert.ok(cookies[name]?.value, `${name} is set`);
      assert.ok(cookies[name].attrs.includes("httponly"), `${name} is httpOnly`);
      assert.ok(cookies[name].attrs.includes("samesite=lax"), `${name} is SameSite=Lax`);
      assert.ok(cookies[name].attrs.includes("path=/"));
    }
    assert.ok(cookies.sw_access.attrs.includes("max-age=900"), "access token lasts 15 minutes");
  });

  it("authenticates with the cookie alone - no Authorization header", async () => {
    const { browser, email } = await signedInBrowser();
    const me = await browser.get("/user/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, email);
  });

  it("stores only a hash of the refresh token", async () => {
    const { cookies, userId } = await signedInBrowser();
    const stored = await sessions().findOne({ userId: new ctx.db.base.Types.ObjectId(userId) });
    assert.match(stored.refreshTokenHash, /^[a-f0-9]{64}$/);
    assert.notEqual(stored.refreshTokenHash, cookies.sw_refresh.value);
  });

  it("registration signs the new user in too", async () => {
    const browser = request.agent(ctx.app);
    const res = await browser.post("/user/register").send({
      firstName: "Reg", lastName: "Test", email: `reg-${Date.now()}@test.io`,
      password: PASSWORD, confirmPassword: PASSWORD, currency: "USD",
    });
    assert.equal(res.status, 201);
    assert.equal((await browser.get("/user/me")).status, 200);
  });
});

describe("refresh", () => {
  it("rotates both cookies and keeps the user signed in", async () => {
    const { browser, cookies } = await signedInBrowser();
    const res = await browser.post("/user/refresh");
    assert.equal(res.status, 200);
    const fresh = parseCookies(res);
    assert.notEqual(fresh.sw_refresh.value, cookies.sw_refresh.value, "refresh token rotated");
    assert.notEqual(fresh.sw_access.value, cookies.sw_access.value);
    assert.equal((await browser.get("/user/me")).status, 200);
  });

  it("tolerates two tabs refreshing with the same token at once", async () => {
    const { cookies } = await signedInBrowser();
    const oldRefresh = `sw_refresh=${cookies.sw_refresh.value}`;
    const first = await ctx.api.post("/user/refresh").set("Cookie", oldRefresh);
    const second = await ctx.api.post("/user/refresh").set("Cookie", oldRefresh);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200, "the slower tab is not signed out");
  });

  it("treats reuse of an old refresh token as theft and signs out everywhere", async () => {
    const { browser, cookies, userId } = await signedInBrowser();
    await browser.post("/user/refresh"); // legitimate rotation
    // Pretend the rotation happened long ago (outside the grace period)
    await sessions().updateMany(
      { userId: new ctx.db.base.Types.ObjectId(userId), replacedBy: { $ne: null } },
      { $set: { revokedAt: new Date(Date.now() - 60_000) } }
    );

    const stolen = await ctx.api.post("/user/refresh").set("Cookie", `sw_refresh=${cookies.sw_refresh.value}`);
    assert.equal(stolen.status, 401);
    assert.equal((await browser.get("/user/me")).status, 401, "the real user's session was revoked too");
  });

  it("fails without a refresh cookie or with an unknown one", async () => {
    assert.equal((await ctx.api.post("/user/refresh")).status, 401);
    assert.equal((await ctx.api.post("/user/refresh").set("Cookie", "sw_refresh=not-a-real-token")).status, 401);
  });
});

describe("expiry", () => {
  it("returns 401 for an expired access token so the client knows to refresh", async () => {
    const { userId } = await signedInBrowser();
    const expired = jwt.sign({ id: userId, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET);
    assert.equal((await ctx.api.get("/user/me").set("Cookie", `sw_access=${expired}`)).status, 401);
  });

  it("returns 403 for a forged token", async () => {
    const forged = jwt.sign({ id: "x" }, "wrong-secret");
    assert.equal((await ctx.api.get("/user/me").set("Cookie", `sw_access=${forged}`)).status, 403);
  });
});

describe("ending sessions", () => {
  it("logout works immediately and clears the cookies", async () => {
    const { browser } = await signedInBrowser();
    const res = await browser.post("/user/logout");
    assert.equal(res.status, 200);
    const cleared = parseCookies(res);
    assert.ok(cleared.sw_access && cleared.sw_refresh, "both cookies are cleared");

    assert.equal((await browser.get("/user/me")).status, 401);
    assert.equal((await browser.post("/user/refresh")).status, 401);
  });

  it("logout without a session still succeeds", async () => {
    assert.equal((await ctx.api.post("/user/logout")).status, 200);
  });

  it("changing the password signs out other devices but not this one", async () => {
    const { email } = await createUser(ctx.api);
    const laptop = request.agent(ctx.app);
    const phone = request.agent(ctx.app);
    await laptop.post("/user/login").send({ email, password: PASSWORD });
    await phone.post("/user/login").send({ email, password: PASSWORD });

    const res = await laptop.put("/user/change-password").send({ currentPassword: PASSWORD, newPassword: "Str0ngerPass", confirmNewPassword: "Str0ngerPass" });
    assert.equal(res.status, 200);
    assert.equal((await laptop.get("/user/me")).status, 200, "the device that changed it stays signed in");
    assert.equal((await phone.get("/user/me")).status, 401, "other devices are signed out");
  });

  it("resetting the password signs out every device", async () => {
    const { browser, email } = await signedInBrowser();
    await ctx.api.post("/user/forgot-password").send({ email });
    const user = await ctx.db.collection("users").findOne({ email });
    // Use a known reset token
    const { generateToken } = await import("../utils/tokens.js");
    const reset = generateToken();
    await ctx.db.collection("users").updateOne({ _id: user._id }, { $set: { resetPasswordToken: reset.hash, resetPasswordExpires: new Date(Date.now() + 60_000) } });

    const res = await ctx.api.post(`/user/reset-password?token=${reset.raw}`).send({ password: "NewPassw0rd", confirmPassword: "NewPassw0rd" });
    assert.equal(res.status, 200);
    assert.equal((await browser.get("/user/me")).status, 401);
  });

  it("deleting the account removes its sessions and clears the cookies", async () => {
    const { browser, userId } = await signedInBrowser();
    const res = await browser.delete("/user/me").send({ password: PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(parseCookies(res).sw_access, "cookies cleared");
    assert.equal(await sessions().countDocuments({ userId: new ctx.db.base.Types.ObjectId(userId) }), 0);
  });
});

describe("compatibility", () => {
  it("still accepts Bearer tokens from older clients", async () => {
    const { token } = await createUser(ctx.api);
    assert.equal((await ctx.api.get("/user/me").set(auth(token))).status, 200);
  });
});

describe("Google sign-in redirect", () => {
  const opts = { frontendUrl: "https://spendwise.vercel.app", secret: "s" };

  it("sends no token in the URL when Google returns through the app's /api proxy", () => {
    const url = callbackRedirectUrl("u1", { ...opts, baseUrl: "https://spendwise.vercel.app/api" });
    assert.equal(url, "https://spendwise.vercel.app/auth/callback");
  });

  it("keeps the old token-in-URL flow while BASE_URL is the API's own address", () => {
    const url = callbackRedirectUrl("u1", { ...opts, baseUrl: "https://api.onrender.com" });
    assert.match(url, /^https:\/\/spendwise\.vercel\.app\/auth\/callback\?token=[\w-]+\.[\w-]+\.[\w-]+&userId=u1$/);
  });
});
