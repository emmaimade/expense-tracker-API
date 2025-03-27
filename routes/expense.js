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
router.get("/get-expenses", authMiddleware, getExpenses);
router.get("/get-past-week-expenses", authMiddleware, getPastWeekExpenses);
router.get("/get-past-month-expenses", authMiddleware, getPastMonthExpenses);
router.get("/get-three-months-expenses", authMiddleware, getThreeMonthsExpenses);
router.get("/get-custom-expenses", authMiddleware, getCustomExpenses);
router.put("/update-expense/:id", authMiddleware, updateExpense);
router.delete("/delete-expense/:id", authMiddleware, deleteExpense);

module.exports = router;