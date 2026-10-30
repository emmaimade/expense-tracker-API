import mongoose from "mongoose";
import Budget from "../models/Budget.js";
import Expense from "../models/Expense.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getCurrencySymbol } from "./currency.js";

// Highest first: only the highest threshold reached is reported, so a jump
// from 70% to 110% gives one "exceeded" alert instead of three
const THRESHOLDS = [
  { percent: 120, priority: "high", title: "Budget well over limit" },
  { percent: 100, priority: "high", title: "Budget exceeded" },
  { percent: 80, priority: "medium", title: "Budget almost used up" },
];

const formatMoney = (amount, symbol) =>
  `${symbol}${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildMessage = (percent, categoryName, spent, limit, symbol) => {
  const used = `${formatMoney(spent, symbol)} of ${formatMoney(limit, symbol)}`;
  if (percent >= 100) {
    return `You've spent ${used} on ${categoryName} this month - ${formatMoney(spent - limit, symbol)} over budget.`;
  }
  return `You've used ${Math.floor((spent / limit) * 100)}% of your ${categoryName} budget (${used}).`;
};

/**
 * Check one category's budget for the month containing `date` and record an
 * alert if a new threshold was reached. Never throws: an alert failing must not
 * fail the expense or budget change that triggered it.
 */
export async function checkBudgetAlert(userId, categoryId, date = new Date()) {
  try {
    const when = new Date(date);
    // Same month boundaries as Budget.getBudgetOverview (server time)
    const month = when.getMonth() + 1;
    const year = when.getFullYear();

    const budget = await Budget.findOne({ userId, categoryId, month, year }).populate("categoryId", "name");
    if (!budget || budget.amount <= 0) return null;

    const [{ spent = 0 } = {}] = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(String(userId)),
          category: new mongoose.Types.ObjectId(String(categoryId)),
          date: { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month, 0, 23, 59, 59, 999) },
        },
      },
      { $group: { _id: null, spent: { $sum: "$amount" } } },
    ]);

    const percent = (spent / budget.amount) * 100;
    const reached = THRESHOLDS.find((t) => percent >= t.percent);
    if (!reached) return null;

    // Already told them about this level (or a higher one) this month?
    const alreadyNotified = await Notification.exists({
      userId,
      budgetId: budget._id,
      threshold: { $gte: reached.percent },
    });
    if (alreadyNotified) return null;

    const user = await User.findById(userId).select("currency");
    const symbol = getCurrencySymbol(user?.currency || "USD");
    const categoryName = budget.categoryId?.name || "this category";

    return await Notification.create({
      userId,
      type: "budget_alert",
      priority: reached.priority,
      title: reached.title,
      message: buildMessage(percent, categoryName, spent, budget.amount, symbol),
      actionUrl: "/dashboard/budgets",
      dedupeKey: `budget:${budget._id}:${reached.percent}`,
      threshold: reached.percent,
      budgetId: budget._id,
    });
  } catch (error) {
    // Duplicate key = a concurrent request already recorded this alert
    if (error?.code !== 11000) console.error("Budget alert check failed:", error);
    return null;
  }
}

/**
 * Record a "new month" notice the first time a user fetches notifications in
 * a month, if their account existed before that month started.
 */
export async function ensureMonthlyNotice(user, now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!user?.createdAt || user.createdAt >= monthStart) return;

  const key = `month:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthName = now.toLocaleString("en-US", { month: "long" });
  try {
    await Notification.updateOne(
      { userId: user._id, dedupeKey: key },
      {
        $setOnInsert: {
          type: "monthly_reset",
          priority: "low",
          title: `Welcome to ${monthName}`,
          message: "A new month has started - your budget tracking starts fresh. Review your budgets for the month ahead.",
          actionUrl: "/dashboard/budgets",
        },
      },
      { upsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) console.error("Monthly notice failed:", error);
  }
}
