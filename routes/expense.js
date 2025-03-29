import express from "express";

import {
  addExpense,
  getExpenses,
  getPastWeekExpenses,
  getPastMonthExpenses,
  getThreeMonthsExpenses,
  getCustomExpenses,
  updateExpense,
  deleteExpense,
} from "../controllers/expense.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/add-expense", authMiddleware, addExpense);
router.get("/", authMiddleware, getExpenses);
router.get("/past-week-expenses", authMiddleware, getPastWeekExpenses);
router.get("/past-month-expenses", authMiddleware, getPastMonthExpenses);
router.get("/three-months-expenses", authMiddleware, getThreeMonthsExpenses);
router.get("/custom-expenses", authMiddleware, getCustomExpenses);
router.patch("/update-expense/:id", authMiddleware, updateExpense);
router.delete("/delete-expense/:id", authMiddleware, deleteExpense);

export default router;