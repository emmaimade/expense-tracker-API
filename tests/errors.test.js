import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupApp, createUser, auth } from "./helpers.js";
import { errorHandler } from "../middleware/errorHandler.js";

// Minimal stand-in for Express's response object
const fakeRes = () => {
  const res = { headersSent: false, statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const handle = (error) => {
  const res = fakeRes();
  errorHandler(error, {}, res, () => {});
  return res;
};

describe("error handler", () => {
  it("hides internal details of server errors", () => {
    const original = console.error;
    console.error = () => {}; // the handler logs 5xx errors; keep test output clean
    try {
      const res = handle(new Error("E11000 duplicate key error collection: test.users index: email_1"));
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, "Something went wrong. Please try again.");
      assert.ok(!JSON.stringify(res.body).includes("E11000"));
    } finally {
      console.error = original;
    }
  });

  it("passes client error messages through", () => {
    const error = Object.assign(new Error("Amount must be a positive number"), { status: 400 });
    const res = handle(error);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "Amount must be a positive number");
  });

  it("treats a status outside 400-599 as a server error", () => {
    const original = console.error;
    console.error = () => {};
    try {
      const res = handle(Object.assign(new Error("odd"), { status: 302 }));
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.message, "Something went wrong. Please try again.");
    } finally {
      console.error = original;
    }
  });

  it("leaves a response that has already started to Express", () => {
    const res = fakeRes();
    res.headersSent = true;
    let forwarded = null;
    errorHandler(new Error("late"), {}, res, (err) => {
      forwarded = err;
    });
    assert.equal(forwarded?.message, "late");
    assert.equal(res.body, null);
  });
});

describe("failures in endpoints that handle their own errors", () => {
  let ctx;
  before(async () => { ctx = await setupApp(); });
  after(async () => { await ctx.close(); });

  it("doesn't expose a database error from /health", async (t) => {
    const { default: mongoose } = await import("mongoose");
    t.mock.method(console, "error", () => {});
    t.mock.method(mongoose.connection.db, "admin", () => {
      throw new Error("connect ECONNREFUSED secret-db-host:27017");
    });

    const res = await ctx.api.get("/health");
    assert.equal(res.status, 503);
    assert.equal(res.body.database, "disconnected");
    assert.ok(!JSON.stringify(res.body).includes("secret-db-host"));
  });

  it("doesn't expose a database error when deleting a category", async (t) => {
    const { default: Category } = await import("../models/Category.js");
    const { token } = await createUser(ctx.api);
    t.mock.method(console, "error", () => {});
    t.mock.method(Category, "findOne", () => {
      throw new Error("MongoServerError: secret-db-host unavailable");
    });

    const res = await ctx.api.delete("/category/507f1f77bcf86cd799439011").set(auth(token));
    assert.equal(res.status, 500);
    assert.equal(res.body.message, "Failed to delete category");
    assert.ok(!JSON.stringify(res.body).includes("secret-db-host"));
  });
});

describe("malformed JSON body", () => {
  let ctx;
  before(async () => { ctx = await setupApp(); });
  after(async () => { await ctx.close(); });

  it("answers 400 with a clear message", async () => {
    const res = await ctx.api
      .post("/user/login")
      .set("Content-Type", "application/json")
      .send('{"email": "a@example.com", "password": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "The request body is not valid JSON");
  });
});
