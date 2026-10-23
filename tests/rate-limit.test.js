// Runs with the production limit (10 per 15 min), so it lives in its own
// file - node --test gives each file a fresh process and limiter.
import { it, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupApp } from "./helpers.js";

let ctx;
before(async () => { ctx = await setupApp({ AUTH_RATE_LIMIT: "" }); });
after(async () => { await ctx.close(); });

it("blocks the 11th auth request from the same IP", async () => {
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    const res = await ctx.api.post("/user/login").send({ email: "nobody@test.io", password: "x" });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
  assert.equal(statuses[10], 429);
});

it("does not rate limit non-auth endpoints", async () => {
  const res = await ctx.api.get("/health");
  assert.equal(res.status, 200);
});
