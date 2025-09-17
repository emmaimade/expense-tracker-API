import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import swaggerUI from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/dbConfig.js";
import userRoutes from "./routes/user.js";
import expenseRoutes from "./routes/expense.js";
import Category from "./models/Category.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// ========================================
// DEFAULT CATEGORIES SETUP
// ========================================

// Default categories
const defaultCategories = [
  "Food",
  "Transportation",
  "Leisure",
  "Electronics",
  "Utilities",
  "Clothing",
  "Health",
  "Education",
  "Others",
];

const createDefaultCategories = async () => {
  try {
    console.log('🏗️  Initializing default categories...');
    
    const existingDefaults = await Category.find({ userId: null, isDefault: true });
    const existingNames = existingDefaults.map((cat) => cat.name.toLowerCase().trim());

    for (const name of defaultCategories) {
      if (!existingNames.includes(name.toLowerCase().trim())) {
        await Category.create({
          name,
          userId: null,
          isDefault: true,
        });
        console.log(`Created default category: ${name}`);
      }
    }
  } catch (err) {
    console.error("Error creating default categories:", err);
  }
};

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting Expense Tracker API...');

    // Connect to database
    await connectDB();

    // Initialize default categories
    await createDefaultCategories();

    console.log("Server setup complete");

    app.listen(port, () => {
      console.log(`🌟 Server running on http://localhost:${port}`);
      console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
      console.log(`💚 Health Check: http://localhost:${port}/health`);
    });

  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
};

startServer();
