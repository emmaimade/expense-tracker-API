import mongoose from "mongoose";
import User from "./User.js";

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: [
      "Groceries",
      "Transportation",
      "Leisure",
      "Electronics",
      "Utilities",
      "Clothing",
      "Health",
      "Education",
      "Others",
    ],
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
