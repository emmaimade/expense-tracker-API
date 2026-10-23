import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/dbConfig.js";
import createDefaultCategories from "./config/defaultCategories.js";

const port = process.env.PORT;

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
