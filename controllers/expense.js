import mongoose from "mongoose";
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
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
    const { startDate, endDate, category, fileFormat } = req.query;
    const userId = req.user.id;

    // Build query
    const query = { userId, type: 'expense' };
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (category && category !== 'all') {
      query.category = category;
    }

    // Fetch expenses
    const expenses = await Expense.find(query).lean();
    if (!expenses.length) {
      return res.status(404).json({ error: 'No expenses found' });
    }

    if (fileFormat === 'csv') {
      // CSV export
      const csvContent = [
        'Date,Description,Category,Amount',
        ...expenses.map(exp =>
          `"${format(new Date(exp.date), 'yyyy-MM-dd')}","${exp.description}","${exp.category}","${exp.amount.toFixed(2)}"`
        ),
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
      return res.send(csvContent);
    } else if (fileFormat === 'pdf') {
      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=expenses.pdf');
      doc.pipe(res);

      // Header
      doc.fontSize(20).text('Expense Report', { align: 'center' });
      doc.fontSize(12).text(
        `Generated on: ${format(new Date(), 'MMMM dd, yyyy')}`,
        { align: 'center' }
      );
      if (startDate && endDate) {
        doc.text(
          `Date Range: ${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`,
          { align: 'center' }
        );
      }
      if (category && category !== 'all') {
        doc.text(`Category: ${category}`, { align: 'center' });
      }
      doc.moveDown(2);

      // Table setup
      const tableTop = doc.y;
      const col1 = 50; // Date
      const col2 = 150; // Description
      const col3 = 300; // Category
      const col4 = 400; // Amount
      const rowHeight = 20;
      const tableWidth = 500;
      const maxRowsPerPage = 25; // Pagination: rows per page

      // Table headers
      const drawTableHeaders = () => {
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Date', col1, tableTop);
        doc.text('Description', col2, tableTop);
        doc.text('Category', col3, tableTop);
        doc.text('Amount', col4, tableTop, { align: 'right' });

        // Header underline
        doc.moveTo(col1, tableTop + 15)
           .lineTo(col1 + tableWidth, tableTop + 15)
           .stroke();
      };

      drawTableHeaders();

      // Table rows
      doc.font('Helvetica').fontSize(10);
      let currentY = tableTop + rowHeight;
      expenses.forEach((exp, index) => {
        // Check for page break
        if (index > 0 && index % maxRowsPerPage === 0) {
          doc.addPage();
          currentY = 50; // Reset Y position for new page
          drawTableHeaders(); // Redraw headers
        }

        // Row background (alternate colors)
        if (index % 2 === 0) {
          doc.rect(col1, currentY, tableWidth, rowHeight)
             .fillOpacity(0.1)
             .fill('#f5f5f5')
             .fillOpacity(1);
        }

        // Row data
        doc.text(format(new Date(exp.date), 'MMM dd, yyyy'), col1, currentY + 5);
        doc.text(exp.description, col2, currentY + 5, { width: 140, ellipsis: true });
        doc.text(exp.category, col3, currentY + 5);
        doc.text(`$${exp.amount.toFixed(2)}`, col4, currentY + 5, { align: 'right', width: 100 });

        // Row separator
        doc.moveTo(col1, currentY + rowHeight)
           .lineTo(col1 + tableWidth, currentY + rowHeight)
           .stroke();

        currentY += rowHeight;
      });

      // Summary
      const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      doc.moveDown();
      doc.font('Helvetica-Bold').text(`Total: $${total.toFixed(2)}`, col4, doc.y, { align: 'right' });

      // Finalize PDF
      doc.end();
    } else {
      return res.status(400).json({ error: 'Invalid format. Use csv or pdf.' });
    }
  } catch (error) {
    console.error('Error exporting expenses:', error);
    res.status(500).json({ error: 'Failed to export expenses' });
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
