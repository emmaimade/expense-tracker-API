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

router.post("/", authMiddleware, addExpense);
router.get("/", authMiddleware, getExpenses);
router.get("/weekly", authMiddleware, getPastWeekExpenses);
router.get("/monthly", authMiddleware, getPastMonthExpenses);
router.get("/last-3-months", authMiddleware, getThreeMonthsExpenses);
router.get("/custom", authMiddleware, getCustomExpenses);
router.patch("/:id", authMiddleware, updateExpense);
router.delete("/:id", authMiddleware, deleteExpense);

export default router;