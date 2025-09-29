import Budget from '../models/Budget.js';
import Category from '../models/Category.js';

// GET: Budget overview with totals and spending
const getBudgetOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;

    const overview = await Budget.getBudgetOverview(
      userId,
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined
    );

    res.status(200).json({
      success: true,
      message: "Budget overview retrieved successfully",
      data: overview
    });

  } catch (error) {
    console.error('Error getting budget overview:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve budget overview",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// GET: Total monthly budget
const getTotalMonthlyBudget = async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;

    const budgetTotal = await Budget.getTotalMonthlyBudget(
      userId,
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined
    );

    const now = new Date();
    const targetMonth = month ? parseInt(month) : (now.getMonth() + 1);
    const targetYear = year ? parseInt(year) : now.getFullYear();

    res.status(200).json({
      success: true,
      message: "Total monthly budget retrieved successfully",
      data: {
        totalBudget: budgetTotal.totalBudget,
        categoryCount: budgetTotal.categoryCount,
        period: {
          month: targetMonth,
          year: targetYear,
          monthName: new Date(targetYear, targetMonth - 1).toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
          })
        }
      }
    });

  } catch (error) {
    console.error('Error getting total monthly budget:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve total budget",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// GET: Budget trends over time
const getBudgetTrends = async (req, res) => {
  try {
    const userId = req.user.id;
    const { months } = req.query;

    const trends = await Budget.getBudgetTrends(
      userId,
      months ? parseInt(months) : 6
    );

    res.status(200).json({
      success: true,
      message: "Budget trends retrieved successfully",
      data: {
        trends: trends,
        summary: {
          periodsAnalyzed: trends.length,
          averageMonthlyBudget: trends.length > 0 
            ? Math.round(trends.reduce((sum, t) => sum + t.totalBudget, 0) / trends.length)
            : 0,
          averageSpending: trends.length > 0
            ? Math.round(trends.reduce((sum, t) => sum + t.totalSpent, 0) / trends.length)
            : 0
        }
      }
    });

  } catch (error) {
    console.error('Error getting budget trends:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve budget trends",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// POST: Set monthly budget
const setMonthlyBudget = async (req, res) => {
  try {
    const { categoryId, amount, month, year } = req.body;
    const userId = req.user.id;

    // Input validation
    if (!categoryId || !amount || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "Category, amount, month, and year are required"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Budget amount must be greater than 0"
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        message: "Month must be between 1 and 12",
      });
    }

    if (year < 2020 || year > 2030) {
      return res.status(400).json({
        message: "Year must be between 2020 and 2030",
      });
    }

    // Verify category exists and user has access
    const category = await Category.findOne({
      _id: categoryId,
      $or: [
        { isDefault: true, userId: null },
        { userId: userId, isDefault: false }
      ]
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Create or update budget
    const budget = await Budget.findOneAndUpdate(
      { categoryId, userId, month, year },
      { amount },
      { 
        new: true, 
        upsert: true,
        runValidators: true 
      }
    ).populate('categoryId', 'name');

    // Get updated total monthly budget
    const totalBudgetInfo = await Budget.getTotalMonthlyBudget(userId, month, year);

    res.status(201).json({
      success: true,
      message: "Budget set successfully",
      data: {
        budget: {
          id: budget._id,
          category: budget.categoryId.name,
          amount: budget.amount,
          month: budget.month,
          year: budget.year
        },
        monthlyTotals: {
          totalBudget: totalBudgetInfo.totalBudget,
          categoryCount: totalBudgetInfo.categoryCount
        }
      }
    });

  } catch (error) {
    console.error('Error setting budget:', error);
    res.status(500).json({
      success: false,
      message: "Failed to set budget",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// GET: Budget alerts (categories over budget or near limit)
const getBudgetAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;

    const overview = await Budget.getBudgetOverview(
      userId,
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined
    );

    const alerts = {
      overBudget: overview.categories.filter(c => c.isOverBudget),
      nearLimit: overview.categories.filter(c => c.isNearLimit && !c.isOverBudget),
      summary: {
        totalAlerts: 0,
        overBudgetCount: 0,
        nearLimitCount: 0,
        period: overview.period
      }
    };

    alerts.summary.overBudgetCount = alerts.overBudget.length;
    alerts.summary.nearLimitCount = alerts.nearLimit.length;
    alerts.summary.totalAlerts = alerts.summary.overBudgetCount + alerts.summary.nearLimitCount;

    res.status(200).json({
      success: true,
      message: "Budget alerts retrieved successfully",
      data: alerts
    });

  } catch (error) {
    console.error('Error getting budget alerts:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve budget alerts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// DELETE: Delete budget
const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Delete budget
    const budget = await Budget.findByIdAndDelete({ _id: id, userId });
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Budget deleted successfully"
    });

  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete budget",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

export {
  getBudgetOverview,
  getTotalMonthlyBudget,
  getBudgetTrends,
  setMonthlyBudget,
  getBudgetAlerts,
  deleteBudget
};