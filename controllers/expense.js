import Expense from "../models/Expense.js";

const addExpense = async (req, res) => {
    const { amount, category, description } = req.body;

    if (!amount || !category || !description) {
        return res.status(400).json({ error: "Please fill all the fields" });
    }

    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number" });
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

const getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({ userId: req.user.id });
        res.status(200).json(expenses);
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

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

        res.status(200).json({ message: "Expenses for Past Week", expenses});
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error" });   
    }
}



module.exports = {
    addExpense,
    getExpenses,
    getPastWeekExpenses
}