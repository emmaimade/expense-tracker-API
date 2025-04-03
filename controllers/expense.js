import Expense from "../models/Expense.js";

// Create a new expense
const addExpense = async (req, res) => {
    const { amount, category, description } = req.body;

    if (!amount || !category || !description) {
        return res.status(400).json({ error: "Please fill all the fields" });
    }

    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number" });
    }

    if (!["Groceries", "Leisure", "Electronics", "Utilities", "Clothing", "Health", "Others"].includes(category)) {
        return res.status(400).json({ error: "Invalid category, use Groceries, Leisure, Electronics, Utilities, Clothing, Health, Others" });
    }

    try {
        const expense = await Expense.create({
            userId: req.user.id,
            amount,
            category,
            description
        });

        res.status(201).json(expense);
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// Get all expenses
const getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({ userId: req.user.id }).sort({ date: -1 });
        
        if (expenses.length === 0) {
            return res.status(404).json({ message: "No expenses found" });
        }

        const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);

    res.status(200).json({
        expenses,
        totalExpenses
    });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// Get expenses for past week
const getPastWeekExpenses = async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date();
        const lastWeek = new Date();
        lastWeek.setDate(today.getDate() - 7);

        const expenses = await Expense.find({
            userId,
            date: {
                $gte: lastWeek,
                $lte: today
            }
        }).sort({ date: -1 });

        if (expenses.length === 0) {
            return res.status(404).json({ message: "No expenses found" });
        }

        const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);

        res.status(200).json({ 
            message: "Expenses for Past Week", 
            expenses, 
            totalExpenses
        });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });   
    }
}

// Get expenses for past month
const getPastMonthExpenses = async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);

        const expenses = await Expense.find({
            userId,
            date: {
                $gte: lastMonth,
                $lte: today
            }
        }).sort({ date: -1 });

        if (expenses.length === 0) {
            return res.status(404).json({ message: "No expenses found" });
        }

        const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);

        res.status(200).json({ 
            message: "Expenses for Past Month", 
            expenses, 
            totalExpenses 
        });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// Get expenses for past 3 months
const getThreeMonthsExpenses = async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date();
        const last_3_months = new Date();
        last_3_months.setMonth(today.getMonth() - 3);

        const expenses = await Expense.find({
            userId,
            date: {
                $gte: last_3_months,
                $lte: today
            }
        }).sort({ date: -1 });

        if (expenses.length === 0) {
            return res.status(404).json({ message: "No expenses found" });
        }

        const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);

        res.status(200).json({ 
            message: "Expenses for Past 3 Months", 
            expenses, 
            totalExpenses
        });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
}

// Get expenses between custom dates
const getCustomExpenses = async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: "Please provide both start and end dates" });
        }

        if (isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
            return res.status(400).json({ error: "Invalid date format, use YYYY-MM-DD" });
        }

        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({ error: "Start date must be before end date" });
        }

        const expenses = await Expense.find({
            userId,
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        }).sort({ date: -1 });

        if (expenses.length === 0) {
            return res.status(404).json({ message: "No expenses found" });
        }

        const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);

        res.status(200).json({ 
            message: `Expenses between ${startDate} and ${endDate}`, 
            expenses, 
            totalExpenses 
        });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// Update an expense
const updateExpense = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, category, description } = req.body;

        if (!amount || !category || !description) {
            return res.status(400).json({ error: "Please fill all the fields" });
        }

        const existingExpense = await Expense.findOne({ userId, _id: req.params.id });

        if (!existingExpense) {
            return res.status(404).json({ error: "Expense not found" });
        }

        amount = amount ?? existingExpense.amount;
        category = category ?? existingExpense.category;
        description = description ?? existingExpense.description;

        await existingExpense.save();
        res.status(200).json({ message: "Expense updated successfully", existingExpense });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// Delete an expense
const deleteExpense = async (req, res) => {
    try {
        const userId = req.user.id;

        const expense = await Expense.findOneAndDelete({ userId, _id: req.params.id });

        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }

        res.status(200).json({ message: "Expense Deleted Successfully"})
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export {
  addExpense,
  getExpenses,
  getPastWeekExpenses,
  getPastMonthExpenses,
  getThreeMonthsExpenses,
  getCustomExpenses,
  updateExpense,
  deleteExpense,
};