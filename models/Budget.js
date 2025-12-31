import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Budget amount must be positive"],
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
    },
    // Non-destructive conversion fields
    amountOriginal: {
      type: Number
    },
    currencyOriginal: {
      type: String,
      uppercase: true,
      trim: true
    },
    conversionRate: {
      type: Number
    },
    convertedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// One budget per category per month per user
budgetSchema.index({ categoryId: 1, userId: 1, month: 1, year: 1 }, { unique: true });
budgetSchema.index({ userId: 1, month: 1, year: 1 }); // For querying all budgets of a user in a month

// Static method to get total budget for a user in a given month and year
budgetSchema.statics.getTotalMonthlyBudget = async function(userId, month, year) {
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1);
    const targetYear = year || (now.getFullYear());

    const result = await this.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          month: targetMonth,
          year: targetYear,
        },
      },
      {
        $group: {
          _id: null, // Grouping key, null since we want a single result
          totalBudget: { $sum: "$amount" },
          categoryCount: { $sum: 1 },
          categories: {
            $push: {
              categoryId: "$categoryId",
              amount: "$amount",
            },
          },
        },
      },
    ]);

    return result[0] || { totalBudget: 0, categoryCount: 0, categories: [] };
}

// Get budget overview with spending data
budgetSchema.statics.getBudgetOverview = async function (userId, month, year) {
    const mongoose = this.base;
    const Expense = mongoose.model('Expense');

    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1);
    const targetYear = year || (now.getFullYear());

    // Date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Get all budgets for the month
    const budgets = await this.find({
        userId: userId,
        month: targetMonth,
        year: targetYear
    }).populate('categoryId', 'name isDefault').lean();

    if (budgets.length === 0) {
        return {
            totalBudget: 0,
            totalSpent: 0,
            totalRemaining: 0,
            budgetCount: 0,
            overBudgetCount: 0,
            categories: [],
            period: { month: targetMonth, year: targetYear}
        };
    }

    // Get spending data for all categories
    const categoryIds = budgets.map(b => b.categoryId._id);
    const spendingData = await Expense.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                category: { $in: categoryIds },
                date: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$category',
                totalSpent: { $sum: '$amount' },
                expenseCount: { $sum: 1}
            }
        }
    ]);

    // Create spending lookup map
    const spendingMap = new Map();
    spendingData.forEach(item => {
        spendingMap.set(item._id.toString(), {
            spent: item.totalSpent,
            expenseCount: item.expenseCount
        });
    });

    // Combine budget and spending data
    const categories = budgets.map(budget => {
        const categoryId = budget.categoryId._id.toString();
        const spendingInfo = spendingMap.get(categoryId) || { spent: 0, expenseCount: 0 };

        const spent = spendingInfo.spent;
        const remaining = budget.amount - spent;
        const percentageUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        return {
            id: budget._id,
            category: {
                id: budget.categoryId._id,
                name: budget.categoryId.name,
                isDefault: budget.categoryId.isDefault
            },
          budget: budget.amount,
          budgetOriginal: budget.amountOriginal ?? null,
          budgetOriginalCurrency: budget.currencyOriginal ?? null,
          budgetConversionRate: budget.conversionRate ?? null,
          budgetConvertedAt: budget.convertedAt ?? null,
            spent: spent,
            remaining: remaining,
            percentageUsed: Math.round(percentageUsed * 100) / 100,
            isOverBudget: spent > budget.amount,
            isNearLimit: percentageUsed >= 80,
            expenseCount: spendingInfo.expenseCount
        };
    });

    // Calculate totals
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overBudgetCount = categories.filter(c => c.isOverBudget).length;

    return {
        totalBudget: totalBudget,
        totalSpent: totalSpent,
        totalRemaining: totalRemaining,
        budgetCount: budgets.length,
        overBudgetCount: overBudgetCount,
        categories: categories.sort((a, b) => a.category.name.localeCompare(b.category.name)),
        period: { month: targetMonth, year: targetYear},
        summary: {
            percentageUsed: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
            isOverBudget: totalSpent > totalBudget,
            nearLimitCategories: categories.filter(c => c.isNearLimit && !c.isOverBudget).length
        }
    };
};

// Get budget trends over multiple months
budgetSchema.statics.getBudgetTrends = async function(userId, monthsBack = 6) {
  const now = new Date();
  const trends = [];

  for (let i = 0; i < monthsBack; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const overview = await this.getBudgetOverview(userId, month, year);
    trends.unshift({
      month: month,
      year: year,
      monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totalBudget: overview.totalBudget || 0,
      totalSpent: overview.totalSpent || 0,
      percentageUsed: overview.summary?.percentageUsed || 0,
      overBudgetCount: overview.overBudgetCount || 0,
      categoryCount: overview.budgetCount || 0
    });
  }

  return trends;
};

const Budget = mongoose.model('Budget', budgetSchema);

export default Budget;