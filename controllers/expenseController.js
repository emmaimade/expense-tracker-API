import mongoose from "mongoose";
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import Expense from "../models/Expense.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import { getCurrencySymbol } from '../utils/currency.js';

// Reusable date range function
// daysOrMonths: Negative for days back (e.g., -7), positive for months back (e.g., 1)
const getDateRange = (daysOrMonths) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  if (daysOrMonths < 0) start.setDate(today.getDate() + daysOrMonths);
  else start.setMonth(today.getMonth() - daysOrMonths);
  start.setHours(0, 0, 0, 0);
  return { start, end: today };
};

// Create a new expense
const addExpense = async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;

    // Input validation
    if (!amount || !category || !description || !date) {
      return res.status(400).json({
        success: false,
        message: "Please fill all the fields",
      });
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
    }

    // Validate category (must be a valid ObjectId referencing an existing Category)
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
      });
    }
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Validate date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsedDate > today) {
      return res.status(400).json({
        success: false,
        message: "Date cannot be in the future",
      });
    }

    const expense = await Expense.create({
      userId: req.user.id,
      amount,
      category: categoryExists._id,
      description,
      date: parsedDate,
    });

    // Populate category details
    const populatedExpense = await Expense.findById(expense._id).populate(
      "category",
      "name isDefault"
    );

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: { expense: populatedExpense, currency: (await User.findById(req.user.id).select('currency')).currency || 'USD' }
    });
  } catch (err) {
    console.error("Error adding expense:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add expense",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Get all expenses
const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.id })
      .sort({ date: -1 })
      .populate("category", "name isDefault");

    if (expenses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No expenses found",
      });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    const user = await User.findById(req.user.id).select('currency');
    const currency = user?.currency || 'USD';

    res.status(200).json({
      success: true,
      message: "Expenses retrieved successfully",
      data: { expenses, totalExpenses, currency, currencySymbol: getCurrencySymbol(currency) },
    });
  } catch (err) {
    console.error("Error getting expenses:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to get expenses",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Get expenses for past week
const getPastWeekExpenses = async (req, res) => {
  try {
    const { start, end } = getDateRange(-7);

    const expenses = await Expense.find({
      userId: req.user.id,
      date: {
        $gte: start,
        $lte: end,
      },
    })
      .sort({ date: -1 })
      .populate("category", "name isDefault");

    if (expenses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No expenses found",
      });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    const user = await User.findById(req.user.id).select('currency');
    const currency = user?.currency || 'USD';

    res.status(200).json({
      success: true,
      message: "Expenses for past week retrieved successfully",
      data: { expenses, totalExpenses, currency, currencySymbol: getCurrencySymbol(currency) },
    });
  } catch (err) {
    console.error("Error getting past week expenses:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get past week expenses",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Get expenses for past month
const getPastMonthExpenses = async (req, res) => {
  try {
    const { start, end } = getDateRange(1);

    const expenses = await Expense.find({
      userId: req.user.id,
      date: {
        $gte: start,
        $lte: end,
      },
    })
      .sort({ date: -1 })
      .populate("category", "name isDefault");

    if (expenses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No expenses found",
      });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    const user = await User.findById(req.user.id).select('currency');
    const currency = user?.currency || 'USD';

    res.status(200).json({
      success: true,
      message: "Expenses for past month retrieved successfully",
      data: { expenses, totalExpenses, currency, currencySymbol: getCurrencySymbol(currency) },
    });
  } catch (err) {
    console.error("Error getting past month expenses:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get past month expenses",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Get expenses for past 3 months
const getThreeMonthsExpenses = async (req, res) => {
  try {
    const { start, end } = getDateRange(3);

    const expenses = await Expense.find({
      userId: req.user.id,
      date: {
        $gte: start,
        $lte: end,
      },
    })
      .sort({ date: -1 })
      .populate("category", "name isDefault");

    if (expenses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No expenses found",
      });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    const user = await User.findById(req.user.id).select('currency');
    const currency = user?.currency || 'USD';

    res.status(200).json({
      success: true,
      message: "Expenses for past 3 months retrieved successfully",
      data: { expenses, totalExpenses, currency, currencySymbol: getCurrencySymbol(currency) },
    });
  } catch (err) {
    console.error("Error getting past 3 months expenses:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get past 3 months expenses",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Get expenses between custom dates
const getCustomExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide both start and end dates",
      });
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    parsedEndDate.setHours(23, 59, 59, 999);
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format, use YYYY-MM-DD",
      });
    }

    if (parsedStartDate > parsedEndDate) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before end date",
      });
    }

    const expenses = await Expense.find({
      userId,
      date: {
        $gte: parsedStartDate,
        $lte: parsedEndDate,
      },
    })
      .sort({ date: -1 })
      .populate("category", "name isDefault");

    if (expenses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No expenses found",
      });
    }

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    const user = await User.findById(req.user.id).select('currency');
    const currency = user?.currency || 'USD';

    res.status(200).json({
      success: true,
      message: `Expenses between ${startDate} and ${endDate} retrieved successfully`,
      data: { expenses, totalExpenses, currency, currencySymbol: getCurrencySymbol(currency) },
    });
  } catch (err) {
    console.error("Error getting custom expenses:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get custom expenses",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Update an expense
const updateExpense = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, category, description, date } = req.body;

    // Validate expense ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    // Check if expense exist
    const existingExpense = await Expense.findOne({
      userId,
      _id: req.params.id,
    });
    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Validate amount
    if (amount !== undefined) {
      if (isNaN(amount) || amount <= 0) {
        return res.status(404).json({
          success: false,
          message: "Amount must be a positive number",
        });
      }

      existingExpense.amount = amount;
    }

    // Validate category
    if (category !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID format",
        });
      }
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category does not exist",
        });
      }
      existingExpense.category = categoryExists._id;
    }

    existingExpense.description = description ?? existingExpense.description;

    // Validate date
    if (date !== undefined) {
      const parsedDate = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }
      if (parsedDate > today) {
        return res.status(400).json({
          success: false,
          message: "Date cannot be in the future",
        });
      }
      existingExpense.date = parsedDate;
    }

    await existingExpense.save();
    const updatedExpense = await Expense.findById(existingExpense._id).populate(
      "category",
      "name isDefault"
    );
    const user = await User.findById(req.user.id).select('currency');
    const currency = user?.currency || 'USD';

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: { expense: updatedExpense, currency, currencySymbol: getCurrencySymbol(currency) },
    });
  } catch (err) {
    console.error("Error updating expense:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update expense",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
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
      return res.status(404).json({
        success: false, 
        message: "Expense not found" 
      });
    }

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete expense",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

const exportExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category: categoryId, fileFormat } = req.query;
    const userId = req.user.id;

    // Handle date range - fixed logic
    let parsedStartDate, parsedEndDate;

    if (!startDate || !endDate) {
      // Set default date range (last 30 days) if not provided
      const { start, end } = getDateRange(-30);
      parsedStartDate = start;
      parsedEndDate = end;
    } else {
      // Parse provided dates
      parsedStartDate = new Date(startDate);
      parsedEndDate = new Date(endDate);
      
      // Set time bounds for proper date range matching
      parsedStartDate.setHours(0, 0, 0, 0);
      parsedEndDate.setHours(23, 59, 59, 999);
    }

    // Validate parsed dates
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format.' 
      });
    }

    if (parsedStartDate > parsedEndDate) {
      return res.status(400).json({ 
        success: false,
        error: 'Start date must be before or equal to end date' 
      });
    }

    // Build query
    const query = { userId, date: { $gte: parsedStartDate, $lte: parsedEndDate } };

    // Add category filter
    if (categoryId && categoryId !== 'all') {
      // Validate category
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID format",
        });
      }
      const categoryExists = await Category.findById(categoryId);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category does not exist",
        });
      }
      query.category = categoryId;
    }

    // Fetch expenses with limit
    const expenses = await Expense.find(query)
      .sort({ date: -1 })
      .limit(1000)
      .populate('category', 'name')
      .lean();
    
    console.log('Found expenses:', expenses.length); // Debug log
    
    if (!expenses.length) {
      return res.status(404).json({
        success: false,
        error: 'No expenses found for the specified date range and filters',
      });
    }

    const user = await User.findById(userId).select('currency');
    const currency = user?.currency || 'USD';
    const symbol = getCurrencySymbol(currency);

    if (fileFormat === 'csv') {
      // CSV export with proper escaping; include original values when present
      const csvContent = [
        'Date,Description,Category,Amount,OriginalAmount,OriginalCurrency',
        ...expenses.map(exp =>
          `"${format(new Date(exp.date), 'yyyy-MM-dd')}","${exp.description.replace(/"/g, '""')}","${exp.category.name}","${symbol}${exp.amount.toFixed(2)}","${exp.amountOriginal ?? ''}","${exp.currencyOriginal ?? ''}"`
        ),
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
      return res.send(csvContent);
    } 
    
    else if (fileFormat === 'pdf') {
      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=expenses.pdf');
      doc.pipe(res);

      // Header
      doc.fontSize(20)
         .fillColor('black')
         .text('Expense Report', { align: 'center' });
         
      doc.fontSize(12)
         .text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy')}`, { align: 'center' });
      
      // Show actual date range used (not just query params)
      doc.text(
        `Date Range: ${format(parsedStartDate, 'MMM dd, yyyy')} - ${format(parsedEndDate, 'MMM dd, yyyy')}`,
        { align: 'center' }
      );
      
      if (categoryId && categoryId !== 'all') {
        doc.text(`Category: ${expenses[0].category.name}`, { align: 'center' });
      }
      doc.moveDown(2);

      // Table setup
      let tableTop = doc.y;
      const col1 = 50; // Date
      const col2 = 150; // Description
      const col3 = 300; // Category
      const col4 = 400; // Amount
      const rowHeight = 20;
      const tableWidth = 500;
      const maxRowsPerPage = 25; // Pagination: rows per page

      // Table headers function
      const drawTableHeaders = (yPosition) => {
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor('black')
           .fillOpacity(1);
           
        doc.text('Date', col1, yPosition);
        doc.text('Description', col2, yPosition);
        doc.text('Category', col3, yPosition);
        doc.text('Amount', col4, yPosition, { align: 'right' });

        // Header underline
        doc.strokeColor('black')
           .moveTo(col1, yPosition + 15)
           .lineTo(col1 + tableWidth, yPosition + 15)
           .stroke();
        
        return yPosition + rowHeight;
      };

      let currentY = drawTableHeaders(tableTop);

      // Table rows
      doc.font('Helvetica').fontSize(10);
      expenses.forEach((exp, index) => {
        // Check for page break
        if (index > 0 && index % maxRowsPerPage === 0) {
          doc.addPage();
          tableTop = 50;
          currentY = drawTableHeaders(tableTop);
        }

        // Row background (alternate colors)
        if (index % 2 === 0) {
          doc.rect(col1, currentY, tableWidth, rowHeight)
             .fillOpacity(0.05)
             .fillColor('#f9f9f9')
             .fill();
        }

        // Reset fill color and opacity for text
        doc.fillColor('black')
           .fillOpacity(1);

        // Row data
        doc.text(format(new Date(exp.date), 'MMM dd, yyyy'), col1, currentY + 5);
        doc.text(exp.description, col2, currentY + 5, { width: 140, ellipsis: true });
        doc.text(exp.category.name, col3, currentY + 5);
        let amountLine = `${symbol}${exp.amount.toFixed(2)}`;
        if (exp.amountOriginal !== undefined && exp.currencyOriginal) {
          amountLine += `\n(orig: ${exp.currencyOriginal} ${Number(exp.amountOriginal).toFixed(2)})`;
        }
        doc.text(amountLine, col4, currentY + 5, { align: 'right', width: 100 });

        // Row separator
        doc.strokeColor('#e5e5e5')
           .moveTo(col1, currentY + rowHeight)
           .lineTo(col1 + tableWidth, currentY + rowHeight)
           .stroke();

        currentY += rowHeight;
      });

      // Summary
      const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      doc.moveDown();
      
      // Summary line separator
      doc.strokeColor('black')
         .moveTo(col3, doc.y)
         .lineTo(col1 + tableWidth, doc.y)
         .stroke();
         
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold')
        .fillColor('black')
        .fillOpacity(1)
        .text(`Total: ${symbol}${total.toFixed(2)}`, col4, doc.y, { align: 'right', width: 100 });

      // Finalize PDF
      doc.end();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid file format. Use "csv" or "pdf"'
      });
    }
  } catch (error) {
    console.error('Error exporting expenses:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to export expenses',
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
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
