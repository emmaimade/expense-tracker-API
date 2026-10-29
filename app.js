import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import bodyParser from "body-parser";
import swaggerUI from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { fileURLToPath } from "url";
import passport from 'passport';
import { initializePassport } from './config/passport.js';
import userRoutes from "./routes/user.js";
import expenseRoutes from "./routes/expense.js";
import categoryRoutes from "./routes/category.js";
import budgetRoutes from "./routes/budget.js";
import authRoutes from './routes/auth.js';
import sanitizeMiddleware from './middleware/sanitizeMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Only allow the frontend (and local dev) to call the API from a browser
const allowedOrigins = [
  process.env.FRONTEND_URL?.replace(/\/$/, ""),
  "http://localhost:5173",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Requests without an Origin header (curl, server-to-server) are allowed
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, false);
  },
};

// Number of proxies in front of the app, so req.ip (used for rate limiting) is
// the real client: 1 = Render only; 2 = Vercel's /api proxy + Render
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

initializePassport();
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(passport.initialize());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(sanitizeMiddleware);

// ==============================================
//  SWAGGER DOCUMENTATION SETUP
// ==============================================

const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));

// swagger api-docs endpoint
app.use(
  "/api-docs",
  swaggerUI.serve,
  swaggerUI.setup(swaggerDocument, {
    customCss: `
  .swagger-ui .topbar { 
    background-color: #2c3e50;
    border-bottom: 3px solid #3498db;
  }
  .swagger-ui .info .title { 
    color: #2c3e50;
    font-size: 2.5em;
  }
  .swagger-ui .info .description {
    color: #7f8c8d;
  }
`,
    // custom page title
    customSiteTitle: "Expense Tracker API Documentation",

    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "none",
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
  })
);

app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerDocument);
});

// ========================================
// API ROUTES - GENERAL ENDPOINTS
// ========================================

// welcome endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Expense Tracker API",
    version: "1.0.0",
    description: "RESTful API for managing personal expenses",
    documentation: `${req.protocol}://${req.get("host")}/api-docs`,
  });
});

// healthcheck endpoint
app.get("/health", async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: "connected",
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(503).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error.message,
    });
  }
});

app.use("/user", userRoutes);
app.use("/expense", expenseRoutes);
app.use("/category", categoryRoutes);
app.use("/budget", budgetRoutes);
app.use('/auth', authRoutes);

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================

// Handle 404 errors for undefined routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: {
      documentation: "/api-docs",
      health: "/health",
      auth: ["/user/register", "/user/login"],
      expenses: ["/expense", "/expense/weekly", "/expense/monthly"],
    },
  });
});

// Global error handler for uncaught errors
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? error.stack
        : "Something went wrong",
    timestamp: new Date().toISOString(),
  });
});

export default app;
