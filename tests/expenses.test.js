import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupApp, createUser, defaultCategoryId, auth, hoursFromNow } from "./helpers.js";

let ctx, token, food;
before(async () => {
  ctx = await setupApp();
  ({ token } = await createUser(ctx.api));
  food = await defaultCategoryId(ctx.api, token);
});
after(async () => { await ctx.close(); });

const addExpense = (date, extra = {}) =>
  ctx.api.post("/expense").set(auth(token)).send({ amount: 5, category: food, description: "x", date, ...extra });

describe("empty lists", () => {
  for (const path of ["/expense", "/expense/weekly", "/expense/monthly", "/expense/three-months", "/expense/custom?startDate=2020-01-01&endDate=2020-01-31"]) {
    it(`GET ${path.split("?")[0]} returns 200 with [] when there is no data`, async () => {
      const { token: freshToken } = await createUser(ctx.api);
      const res = await ctx.api.get(path).set(auth(freshToken));
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data.expenses, []);
      assert.equal(res.body.data.totalExpenses, 0);
    });
  }
});

describe("future-date check", () => {
  it("accepts past dates and any timezone's 'today' (up to 14h ahead)", async () => {
    assert.equal((await addExpense(hoursFromNow(-24))).status, 201);
    assert.equal((await addExpense(hoursFromNow(13))).status, 201);
  });

  it("rejects dates in the future everywhere", async () => {
    assert.equal((await addExpense(hoursFromNow(15))).status, 400);
  });

  it("applies the same rule on update", async () => {
    const id = (await addExpense(hoursFromNow(-1))).body.data.expense._id;
    const future = await ctx.api.patch(`/expense/${id}`).set(auth(token)).send({ date: hoursFromNow(15) });
    assert.equal(future.status, 400);
    const today = await ctx.api.patch(`/expense/${id}`).set(auth(token)).send({ date: hoursFromNow(13) });
    assert.equal(today.status, 200);
  });
});

describe("validation", () => {
  it("returns 400 (not 404) for a negative amount on update", async () => {
    const id = (await addExpense(hoursFromNow(-1))).body.data.expense._id;
    const res = await ctx.api.patch(`/expense/${id}`).set(auth(token)).send({ amount: -5 });
    assert.equal(res.status, 400);
  });
});

describe("listing and totals", () => {
  it("returns this week's expenses with the correct total", async () => {
    const { token: t } = await createUser(ctx.api);
    const cat = await defaultCategoryId(ctx.api, t);
    await ctx.api.post("/expense").set(auth(t)).send({ amount: 12.5, category: cat, description: "Lunch", date: new Date().toISOString() });

    const res = await ctx.api.get("/expense/weekly").set(auth(t));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.expenses.length, 1);
    assert.equal(res.body.data.totalExpenses, 12.5);
  });
});

describe("export", () => {
  it("returns 404 with a message when there is nothing to export", async () => {
    const { token: t } = await createUser(ctx.api);
    const res = await ctx.api.get("/expense/export?fileFormat=csv").set(auth(t));
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(typeof res.body.message, "string");
  });

  it("uses { success, message } for invalid dates", async () => {
    const invalid = await ctx.api.get("/expense/export?startDate=nope&endDate=2026-01-01&fileFormat=csv").set(auth(token));
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.message, /Invalid date/);

    const reversed = await ctx.api.get("/expense/export?startDate=2026-02-01&endDate=2026-01-01&fileFormat=csv").set(auth(token));
    assert.equal(reversed.status, 400);
    assert.match(reversed.body.message, /before/);
  });

  it("exports CSV for the user's own expenses", async () => {
    const res = await ctx.api.get("/expense/export?fileFormat=csv").set(auth(token));
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.match(res.text, /^Date,Description,Category,Amount/);
  });
});
