// Runs with the production limits, so it lives in its own file - node --test
// gives each file a fresh process and fresh limiters.
import { it, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupApp, PASSWORD } from "./helpers.js";

let ctx;
before(async () => { ctx = await setupApp({ AUTH_RATE_LIMIT: "", ACCOUNT_RATE_LIMIT: "" }); });
after(async () => { await ctx.close(); });

// With "trust proxy" = 1, X-Forwarded-For decides req.ip - the same header an
// attacker calling the API directly could fake to look like many clients
let ipCounter = 0;
const freshIp = () => `203.0.113.${++ipCounter}`;

const login = (email, password, ip) => {
  const req = ctx.api.post("/user/login").send({ email, password });
  return ip ? req.set("X-Forwarded-For", ip) : req;
};

it("blocks the 11th auth request from the same IP", async () => {
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    statuses.push((await login("nobody@test.io", "x")).status);
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
  assert.equal(statuses[10], 429);
});

it("limits failed sign-ins per account even when the IP changes every time", async () => {
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    statuses.push((await login("victim@test.io", "Wr0ngGuess", freshIp())).status);
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
  assert.equal(statuses[10], 429, "rotating IPs must not get around the per-account limit");
});

it("does not count successful sign-ins toward the account limit", async () => {
  // Register from a fresh IP - the default test IP is used up by the first test
  const email = `ok-${Date.now()}@test.io`;
  const reg = await ctx.api.post("/user/register").set("X-Forwarded-For", freshIp())
    .send({ firstName: "Sam", lastName: "Test", email, password: PASSWORD, confirmPassword: PASSWORD, currency: "USD" });
  assert.equal(reg.status, 201);

  for (let i = 0; i < 12; i++) {
    const res = await login(email, PASSWORD, freshIp());
    assert.equal(res.status, 200, `successful sign-in #${i + 1} should not be limited`);
  }
});

it("limits password-reset emails per address across IPs", async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const res = await ctx.api.post("/user/forgot-password").set("X-Forwarded-For", freshIp()).send({ email: "inbox@test.io" });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses.slice(0, 5), Array(5).fill(200));
  assert.equal(statuses[5], 429, "a 6th reset email within an hour is refused");
});

it("does not rate limit non-auth endpoints", async () => {
  const res = await ctx.api.get("/health");
  assert.equal(res.status, 200);
});
