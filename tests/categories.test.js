import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setupApp, createUser, auth } from "./helpers.js";

const MIGRATION = fileURLToPath(new URL("../scripts/fix-category-index.js", import.meta.url));

let ctx;
before(async () => { ctx = await setupApp(); });
after(async () => { await ctx.close(); });

const addCategory = (token, name) => ctx.api.post("/category").set(auth(token)).send({ name });

describe("category names", () => {
  it("handles regex special characters literally", async () => {
    const { token } = await createUser(ctx.api);
    assert.equal((await addCategory(token, "C++ (dev)")).status, 201);
    assert.equal((await addCategory(token, "c++ (DEV)")).status, 409, "case-insensitive duplicate");
    assert.equal((await addCategory(token, ".*")).status, 201, "'.*' must not match every category");
  });

  it("rejects names that match a default category", async () => {
    const { token } = await createUser(ctx.api);
    const res = await addCategory(token, "food");
    assert.equal(res.status, 409);
  });
});

describe("legacy global name index migration", () => {
  const indexNames = async () => (await ctx.db.collection("categories").indexes()).map((i) => i.name);
  const migrate = (...args) => execFileSync(process.execPath, [MIGRATION, ...args], { env: process.env, encoding: "utf8" });

  it("lets different users reuse a name once the old index is dropped", async () => {
    // Recreate the production state: a unique index on name alone
    await ctx.db.collection("categories").createIndex({ name: 1 }, { unique: true, name: "name_1" });

    const a = await createUser(ctx.api);
    const b = await createUser(ctx.api);
    assert.equal((await addCategory(a.token, "Gym")).status, 201);
    assert.equal((await addCategory(b.token, "Gym")).status, 500, "bug reproduced with the old index");

    const dryRun = migrate();
    assert.match(dryRun, /Dry run/);
    assert.ok((await indexNames()).includes("name_1"), "dry run must not change anything");

    migrate("--apply");
    const after = await indexNames();
    assert.ok(!after.includes("name_1"));
    assert.ok(after.includes("name_1_userId_1"), "per-user unique index is kept");

    assert.match(migrate("--apply"), /nothing to do/, "re-running is a no-op");

    assert.equal((await addCategory(b.token, "Gym")).status, 201);
    assert.equal((await addCategory(a.token, "gym")).status, 409, "duplicates for the same user are still blocked");
  });
});

describe("budgets", () => {
  it("validates month and year with the standard error shape", async () => {
    const { token } = await createUser(ctx.api);
    const food = (await ctx.api.get("/category").set(auth(token))).body.data.find((c) => c.name === "Food")._id;

    const badMonth = await ctx.api.post("/budget").set(auth(token)).send({ categoryId: food, amount: 10, month: 13, year: 2026 });
    assert.equal(badMonth.status, 400);
    assert.equal(badMonth.body.success, false);

    const badYear = await ctx.api.post("/budget").set(auth(token)).send({ categoryId: food, amount: 10, month: 1, year: 2040 });
    assert.equal(badYear.status, 400);
    assert.equal(badYear.body.success, false);

    const ok = await ctx.api.post("/budget").set(auth(token)).send({ categoryId: food, amount: 100, month: 1, year: 2026 });
    assert.equal(ok.status, 201);
  });
});
