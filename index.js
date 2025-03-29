import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import connectDB from "./config/dbConfig.js";
import userRoutes from "./routes/user.js";
import expenseRoutes from "./routes/expense.js"

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// api routes
app.use("/user", userRoutes);
app.use("/expense", expenseRoutes);

app.listen(port, () => {
    console.log(`Server running on port http://localhost:${port}`);
})
