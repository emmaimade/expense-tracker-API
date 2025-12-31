import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/dbConfig.js';
import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';
import User from '../models/User.js';

dotenv.config();

const backfillForUser = async (user) => {
  const defaultCurrency = user.currency || 'USD';

  // Backfill expenses: set amountOriginal & currencyOriginal when missing
  const expenseResult = await Expense.updateMany(
    { userId: user._id, $or: [{ amountOriginal: { $exists: false } }, { currencyOriginal: { $exists: false } }] },
    [
      {
        $set: {
          amountOriginal: { $ifNull: ['$amountOriginal', '$amount'] },
          currencyOriginal: { $ifNull: ['$currencyOriginal', defaultCurrency] }
        }
      }
    ]
  );

  // Backfill budgets: set amountOriginal & currencyOriginal when missing
  const budgetResult = await Budget.updateMany(
    { userId: user._id, $or: [{ amountOriginal: { $exists: false } }, { currencyOriginal: { $exists: false } }] },
    [
      {
        $set: {
          amountOriginal: { $ifNull: ['$amountOriginal', '$amount'] },
          currencyOriginal: { $ifNull: ['$currencyOriginal', defaultCurrency] }
        }
      }
    ]
  );

  return {
    user: user.email,
    expenses: {
      matched: expenseResult.matchedCount ?? expenseResult.matched ?? 0,
      modified: expenseResult.modifiedCount ?? expenseResult.modified ?? 0,
    },
    budgets: {
      matched: budgetResult.matchedCount ?? budgetResult.matched ?? 0,
      modified: budgetResult.modifiedCount ?? budgetResult.modified ?? 0,
    }
  };
};

const run = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    const results = [];
    for (const user of users) {
      console.log(`Processing user: ${user.email}`);
      const res = await backfillForUser(user);
      console.log(`  expenses: matched ${res.expenses.matched}, modified ${res.expenses.modified}`);
      console.log(`  budgets:  matched ${res.budgets.matched}, modified ${res.budgets.modified}`);
      results.push(res);
    }

    console.log('Backfill completed');
    console.table(results.map(r => ({ user: r.user, expensesMatched: r.expenses.matched, expensesModified: r.expenses.modified, budgetsMatched: r.budgets.matched, budgetsModified: r.budgets.modified })));
  } catch (err) {
    console.error('Backfill failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
};

run();
