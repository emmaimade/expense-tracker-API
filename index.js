import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import connectDB from "./config/dbConfig.js";
import userRoutes from "./routes/user.js";
import expenseRoutes from "./routes/expense.js";

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// health check route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Expense Tracker API",
    version: "1.0.0",
    description: "RESTful API for managing personal expenses",
    documentation: `${req.protocol}://${req.get("host")}/api-docs`,
    endpoints: {
      health: "/health",
      docs: "/api-docs",
      auth: {
        register: "POST /user/register",
        login: "POST /user/login",
      },
      expenses: {
        all: "GET /expense",
        weekly: "GET /expense/weekly",
        monthly: "GET /expense/monthly",
        three_months: "GET /expense/three-months",
        custom: "GET /expense/custom",
        create: "POST /expense",
        update: "PATCH /expense/:id",
        delete: "DELETE /expense/:id",
      },
    },
    author: "Imade-Taye Emmanuel",
  });
});

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

// api routes
app.use("/user", userRoutes);
app.use("/expense", expenseRoutes);

app.listen(port, () => {
  console.log(`Server running on port http://localhost:${port}`);
});
