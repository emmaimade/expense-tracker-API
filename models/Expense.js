import mongoose from "mongoose";
import User from "./User.js";
import Category from "./Category.js";

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
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
    // enum: [
    //   "Food",
    //   "Transportation",
    //   "Leisure",
    //   "Electronics",
    //   "Utilities",
    //   "Clothing",
    //   "Health",
    //   "Education",
    //   "Others",
    // ],
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
});

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
