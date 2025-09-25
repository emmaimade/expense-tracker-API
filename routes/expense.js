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
  exportExpenses,
} from "../controllers/expense.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication middleware to all expense routes
router.use(authMiddleware);

router.post("/", addExpense);
router.get("/", getExpenses);
router.get("/weekly", getPastWeekExpenses);
router.get("/monthly", getPastMonthExpenses);
router.get("/three-months", getThreeMonthsExpenses);
router.get("/custom", getCustomExpenses);
router.patch("/:id", updateExpense);
router.delete("/:id", deleteExpense);
router.get("/export", exportExpenses);

export default router;
