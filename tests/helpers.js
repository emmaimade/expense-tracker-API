// Shared test setup: an in-memory MongoDB, the Express app, and a stub for
// email provider calls. Nothing here touches a real database or sends email.
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";

export const PASSWORD = "Passw0rd";

const TEST_ENV = {
  NODE_ENV: "test",
  JWT_SECRET: "test-secret",
  FRONTEND_URL: "https://spendwise.example",
  BASE_URL: "http://localhost:5000",
  GOOGLE_CLIENT_ID: "test-google-id",
  GOOGLE_CLIENT_SECRET: "test-google-secret",
  EMAIL_PROVIDER: "brevo",
  EMAIL_FROM: "SpendWise <sender@example.com>",
  BREVO_API_KEY: "test-brevo-key",
  RESEND_API_KEY: "re_test_key",
  AUTH_RATE_LIMIT: "1000",
};

// ── Email stub ───────────────────────────────────────────────────
// Records calls to Brevo/Resend/Gmail and answers with `emailReply`
// (Google's token endpoint answers with `tokenReply`); every other
// request goes to the real fetch.
export const sentEmails = [];
export const tokenRequests = [];
let emailReply = { status: 201, body: { messageId: "<test@brevo>" } };
let tokenReply = { status: 200, body: { access_token: "test-access-token", expires_in: 3600 } };

export const setEmailReply = (status, body) => {
  emailReply = { status, body };
};

export const setTokenReply = (status, body) => {
  tokenReply = { status, body };
};

const jsonResponse = ({ status, body }) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  const headers = Object.fromEntries(new Headers(options.headers).entries());

  if (target.startsWith("https://oauth2.googleapis.com/token")) {
    tokenRequests.push(Object.fromEntries(new URLSearchParams(String(options.body))));
    return jsonResponse(tokenReply);
  }
  if (/api\.(brevo|resend)\.com|gmail\.googleapis\.com/.test(target)) {
    sentEmails.push({ url: target, headers, body: JSON.parse(options.body) });
    return jsonResponse(emailReply);
  }
  return realFetch(url, options);
};

// ── App + database ───────────────────────────────────────────────
/**
 * Start an in-memory database and load the app. Env vars must be set
 * before the app is imported (CORS and the rate limiter read them at load).
 */
export async function setupApp(envOverrides = {}) {
  // Each test file starts its own MongoDB in parallel; the default 10s
  // start-up limit is too tight on slower machines and CI runners
  const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  Object.assign(process.env, TEST_ENV, envOverrides, { DB_URI: mongo.getUri("test") });

  const { default: app } = await import("../app.js");
  const { createDefaultCategories } = await import("../config/defaultCategories.js");

  await mongoose.connect(process.env.DB_URI);
  await createDefaultCategories();

  return {
    app,
    api: request(app),
    db: mongoose.connection,
    async close() {
      await mongoose.disconnect();
      await mongo.stop();
    },
  };
}

// ── Request helpers ──────────────────────────────────────────────
export const auth = (token) => ({ Authorization: `Bearer ${token}` });

let userCounter = 0;

/** Register a fresh user and return { email, token, user }. */
export async function createUser(api, overrides = {}) {
  userCounter += 1;
  const email = overrides.email || `user${userCounter}-${Date.now()}@test.io`;
  const body = {
    firstName: "Test",
    lastName: `User${userCounter}`,
    email,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    currency: "USD",
    ...overrides,
  };
  const res = await api.post("/user/register").send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { email, token: res.body.token, user: res.body.user };
}

/** Id of a default category (e.g. "Food"). */
export async function defaultCategoryId(api, token, name = "Food") {
  const res = await api.get("/category").set(auth(token));
  return res.body.data.find((c) => c.isDefault && c.name === name)._id;
}

/** Date `hours` from now as an ISO string (negative = past). */
export const hoursFromNow = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();
