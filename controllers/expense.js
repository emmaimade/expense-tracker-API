import mongoose from "mongoose";
import Expense from "../models/Expense.js";

// Create a new expense
const addExpense = async (req, res) => {
  const { amount, category, description, date } = req.body;

  if (!amount || !category || !description || !date) {
    return res.status(400).json({ error: "Please fill all the fields" });
  }

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  if (
    ![
      "Food",
      "Transportation",
      "Leisure",
      "Electronics",
      "Utilities",
      "Clothing",
      "Health",
      "Education",
      "Others",
    ].includes(category)
  ) {
    return res.status(400).json({
      error:
        "Invalid category, use Food, Transportation, Leisure, Electronics, Utilities, Clothing, Health, Education, Others",
    });
  }

  // Validate date
  if (date) {
    const parsedDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({error: "Invalid date format" });
    }
    if (parsedDate > today) {
      return res.status(400).json({ error: "Date cannot be in the future" });
    }
  }

  try {
    const expense = await Expense.create({
      userId: req.user.id,
      amount,
      category,
      description,
      date: date ? new Date(date) : undefined,
    });

    res.status(201).json(expense);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get all expenses
const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.id }).sort({
      date: -1,
    });

    if (expenses.length === 0) {
      return res.status(404).json({ message: "No expenses found" });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    res.status(200).json({
      expenses,
      totalExpenses,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

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
        $lte: today,
      },
    }).sort({ date: -1 });

    if (expenses.length === 0) {
      return res.status(404).json({ message: "No expenses found" });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    res.status(200).json({
      message: "Expenses for Past Week",
      expenses,
      totalExpenses,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

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
        $lte: today,
      },
    }).sort({ date: -1 });

    if (expenses.length === 0) {
      return res.status(404).json({ message: "No expenses found" });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    res.status(200).json({
      message: "Expenses for Past Month",
      expenses,
      totalExpenses,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

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
        $lte: today,
      },
    }).sort({ date: -1 });

    if (expenses.length === 0) {
      return res.status(404).json({ message: "No expenses found" });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    res.status(200).json({
      message: "Expenses for Past 3 Months",
      expenses,
      totalExpenses,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get expenses between custom dates
const getCustomExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Please provide both start and end dates" });
    }

    if (
      isNaN(new Date(startDate).getTime()) ||
      isNaN(new Date(endDate).getTime())
    ) {
      return res
        .status(400)
        .json({ error: "Invalid date format, use YYYY-MM-DD" });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res
        .status(400)
        .json({ error: "Start date must be before end date" });
    }

    const expenses = await Expense.find({
      userId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    }).sort({ date: -1 });

    if (expenses.length === 0) {
      return res.status(404).json({ message: "No expenses found" });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    res.status(200).json({
      message: `Expenses between ${startDate} and ${endDate}`,
      expenses,
      totalExpenses,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update an expense
const updateExpense = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, category, description, date } = req.body;

    // Checks if expense Id is valid
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid expense id" });
    }

    const existingExpense = await Expense.findOne({
      userId,
      _id: req.params.id,
    });

    if (!existingExpense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    if (amount !== undefined) {
      if (isNaN(amount) || amount <= 0) {
        return res
          .status(404)
          .json({ error: "Amount must be a positive number" });
      }

      existingExpense.amount = amount;
    }

    existingExpense.category = category ?? existingExpense.category;
    existingExpense.description = description ?? existingExpense.description;

    // Validate and update date if provided
    if (date !== undefined) {
      const parsedDate = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      if (parsedDate > today) {
        return res.status(400).json({ error: "Date cannot be in the future" });
      }
      existingExpense.date = parsedDate;
    }

    await existingExpense.save();
    res
      .status(200)
      .json({ message: "Expense updated successfully", existingExpense });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete an expense
const deleteExpense = async (req, res) => {
  try {
    const userId = req.user.id;

    const expense = await Expense.findOneAndDelete({
      userId,
      _id: req.params.id,
    });

    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.status(200).json({ message: "Expense Deleted Successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const exportExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, category, format = 'csv' } = req.query;

    // Build query
    const query = { userId };
    if (startDate && endDate) {
      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      if (parsedStartDate > parsedEndDate) {
        return res.status(400).json({ error: 'Start date must be before or equal to end date' });
      }
      if (parsedEndDate > today) {
        return res.status(400).json({ error: 'End date cannot be in the future' });
      }
      query.date = { $gte: parsedStartDate, $lte: parsedEndDate };
    }
    if (category && category !== 'all') {
      if (!['Food', 'Transportation', 'Leisure', 'Electronics', 'Utilities', 'Clothing', 'Health', 'Education', 'Others'].includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      query.category = category;
    }

    // Fetch expenses
    const expenses = await Expense.find(query).lean();
    if (!expenses.length) {
      return res.status(404).json({ error: 'No expenses found for the specified filters' });
    }

    if (format === 'csv') {
      // CSV Export
      const csvWriter = createObjectCsvWriter({
        path: 'expenses.csv',
        header: [
          { id: 'date', title: 'Date' },
          { id: 'description', title: 'Description' },
          { id: 'category', title: 'Category' },
          { id: 'amount', title: 'Amount' },
          { id: 'type', title: 'Type' },
        ],
      });

      const records = expenses.map(expense => ({
        date: new Date(expense.date).toISOString().split('T')[0],
        description: expense.description,
        category: expense.category,
        amount: expense.amount.toFixed(2),
        type: expense.type || 'expense',
      }));

      await csvWriter.writeRecords(records);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
      res.download('expenses.csv');
    } else if (format === 'pdf') {
      // PDF Export
      const doc = new PDFDocument();
      const fileName = 'expenses.pdf';
      const stream = fs.createWriteStream(fileName);
      doc.pipe(stream);

      // Header
      doc.fontSize(16).text('Expense Report', { align: 'center' });
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString('en-US')}`, { align: 'center' });
      if (startDate && endDate) {
        doc.text(`Date Range: ${new Date(startDate).toLocaleDateString('en-US')} - ${new Date(endDate).toLocaleDateString('en-US')}`, { align: 'center' });
      }
      if (category && category !== 'all') {
        doc.text(`Category: ${category}`, { align: 'center' });
      }
      doc.moveDown(2);

      // Table Header
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Date', 50, doc.y, { width: 100 });
      doc.text('Description', 150, doc.y, { width: 200 });
      doc.text('Category', 350, doc.y, { width: 100 });
      doc.text('Amount', 450, doc.y, { width: 100, align: 'right' });
      doc.moveDown(1);
      doc.font('Helvetica');

      // Table Rows
      expenses.forEach(expense => {
        doc.text(new Date(expense.date).toISOString().split('T')[0], 50, doc.y, { width: 100 });
        doc.text(expense.description, 150, doc.y, { width: 200 });
        doc.text(expense.category, 350, doc.y, { width: 100 });
        doc.text(`$${expense.amount.toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });
        doc.moveDown(0.5);
      });

      // Summary
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      doc.moveDown(2);
      doc.font('Helvetica-Bold').text(`Total: $${totalAmount.toFixed(2)}`, { align: 'right' });

      doc.end();

      stream.on('finish', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=expenses.pdf');
        res.download(fileName);
      });
    } else {
      return res.status(400).json({ error: 'Invalid format. Use "csv" or "pdf".' });
    }
  } catch (error) {
    console.error('Error exporting expenses:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
export {
  addExpense,
  getExpenses,
  getPastWeekExpenses,
  getPastMonthExpenses,
  getThreeMonthsExpenses,
  getCustomExpenses,
  updateExpense,
  deleteExpense,
  exportExpenses,
};
