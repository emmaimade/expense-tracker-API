import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupApp, createUser, defaultCategoryId, auth, PASSWORD } from "./helpers.js";

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.close(); });

const now = new Date();
const thisMonth = { month: now.getMonth() + 1, year: now.getFullYear() };

/** A user with a 100 budget on Food this month. */
async function userWithBudget({ currency = "USD", amount = 100 } = {}) {
  const user = await createUser(ctx.api, { currency });
  const food = await defaultCategoryId(ctx.api, user.token);
  const res = await ctx.api.post("/budget").set(auth(user.token)).send({ categoryId: food, amount, ...thisMonth });
  assert.equal(res.status, 201);
  return { ...user, food };
}

const spend = (u, amount, extra = {}) =>
  ctx.api.post("/expense").set(auth(u.token)).send({ amount, category: u.food, description: "x", date: new Date().toISOString(), ...extra });

const list = async (u) => (await ctx.api.get("/notifications").set(auth(u.token))).body.data;
const alerts = async (u) => (await list(u)).notifications.filter((n) => n.type === "budget_alert");

describe("budget alerts", () => {
  it("stay quiet below 80%", async () => {
    const u = await userWithBudget();
    await spend(u, 70);
    assert.equal((await alerts(u)).length, 0);
  });

  it("warn at 80% with the user's own currency", async () => {
    const u = await userWithBudget({ currency: "NGN" });
    await spend(u, 85);
    const [alert] = await alerts(u);
    assert.equal(alert.title, "Budget almost used up");
    assert.equal(alert.priority, "medium");
    assert.match(alert.message, /85% of your Food budget \(₦85\.00 of ₦100\.00\)/);
    assert.equal(alert.actionUrl, "/dashboard/budgets");
    assert.equal(alert.read, false);
  });

  it("send one alert for a big jump, not one per threshold", async () => {
    const u = await userWithBudget();
    await spend(u, 110);
    const all = await alerts(u);
    assert.equal(all.length, 1);
    assert.equal(all[0].title, "Budget exceeded");
    assert.match(all[0].message, /\$110\.00 of \$100\.00 on Food this month - \$10\.00 over budget/);
  });

  it("alert again only when a higher threshold is reached", async () => {
    const u = await userWithBudget();
    await spend(u, 85); // 85% -> warning
    await spend(u, 5); // 90% -> nothing new
    assert.equal((await alerts(u)).length, 1);
    await spend(u, 40); // 130% -> "well over"
    const titles = (await alerts(u)).map((a) => a.title);
    assert.deepEqual(titles, ["Budget well over limit", "Budget almost used up"]);
  });

  it("fire when an edit pushes spending over", async () => {
    const u = await userWithBudget();
    const id = (await spend(u, 10)).body.data.expense._id;
    await ctx.api.patch(`/expense/${id}`).set(auth(u.token)).send({ amount: 105 });
    assert.equal((await alerts(u))[0]?.title, "Budget exceeded");
  });

  it("fire when a lower budget is set for money already spent", async () => {
    const u = await userWithBudget({ amount: 1000 });
    await spend(u, 90);
    assert.equal((await alerts(u)).length, 0);
    await ctx.api.post("/budget").set(auth(u.token)).send({ categoryId: u.food, amount: 100, ...thisMonth });
    assert.equal((await alerts(u))[0]?.title, "Budget almost used up");
  });

  it("ignore categories without a budget", async () => {
    const u = await userWithBudget();
    const transport = await defaultCategoryId(ctx.api, u.token, "Transportation");
    await spend(u, 500, { category: transport });
    assert.equal((await alerts(u)).length, 0);
  });

  it("are not recreated after the user deletes them", async () => {
    const u = await userWithBudget();
    await spend(u, 85);
    const [alert] = await alerts(u);
    assert.equal((await ctx.api.delete(`/notifications/${alert.id}`).set(auth(u.token))).status, 200);
    await spend(u, 1); // still in the 80% band
    assert.equal((await alerts(u)).length, 0);
  });
});

describe("notification endpoints", () => {
  it("count unread and mark one or all as read", async () => {
    const u = await userWithBudget();
    await spend(u, 85);
    await spend(u, 50);
    let data = await list(u);
    assert.equal(data.unreadCount, 2);

    const res = await ctx.api.patch(`/notifications/${data.notifications[0].id}/read`).set(auth(u.token));
    assert.equal(res.status, 200);
    assert.equal((await list(u)).unreadCount, 1);

    await ctx.api.patch("/notifications/read-all").set(auth(u.token));
    data = await list(u);
    assert.equal(data.unreadCount, 0);
    assert.ok(data.notifications.every((n) => n.read));
  });

  it("clear all hides everything", async () => {
    const u = await userWithBudget();
    await spend(u, 130);
    assert.equal((await ctx.api.delete("/notifications").set(auth(u.token))).status, 200);
    const data = await list(u);
    assert.equal(data.notifications.filter((n) => n.type === "budget_alert").length, 0);
  });

  it("don't let users touch each other's notifications", async () => {
    const owner = await userWithBudget();
    await spend(owner, 85);
    const [alert] = await alerts(owner);
    const other = await createUser(ctx.api);
    assert.equal((await ctx.api.patch(`/notifications/${alert.id}/read`).set(auth(other.token))).status, 404);
    assert.equal((await ctx.api.delete(`/notifications/${alert.id}`).set(auth(other.token))).status, 404);
    assert.equal((await alerts(owner))[0].read, false);
  });

  it("reject invalid ids and require sign-in", async () => {
    const u = await createUser(ctx.api);
    assert.equal((await ctx.api.patch("/notifications/not-an-id/read").set(auth(u.token))).status, 400);
    assert.equal((await ctx.api.get("/notifications")).status, 401);
  });
});

describe("new month notice", () => {
  it("is created once for accounts older than this month", async () => {
    const u = await createUser(ctx.api);
    await ctx.db.collection("users").updateOne({ email: u.email }, { $set: { createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 5) } });

    await list(u);
    const data = await list(u);
    const notices = data.notifications.filter((n) => n.type === "monthly_reset");
    assert.equal(notices.length, 1, "fetching twice doesn't duplicate it");
    assert.match(notices[0].title, new RegExp(now.toLocaleString("en-US", { month: "long" })));
  });

  it("is not shown to brand-new accounts", async () => {
    const u = await createUser(ctx.api);
    const data = await list(u);
    assert.equal(data.notifications.filter((n) => n.type === "monthly_reset").length, 0);
  });
});

it("account deletion removes the user's notifications", async () => {
  const u = await userWithBudget();
  await spend(u, 85);
  await ctx.api.delete("/user/me").set(auth(u.token)).send({ password: PASSWORD });
  const id = new ctx.db.base.Types.ObjectId(u.user.id);
  assert.equal(await ctx.db.collection("notifications").countDocuments({ userId: id }), 0);
});
