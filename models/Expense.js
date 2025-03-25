import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: User,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        category: {
            type: String,
            required: true,
            enum: [ 'Groceries', 'Leisure', 'Electronics', 'Utilities', 'Clothing', 'Health', 'Others' ]
        },
        description: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        }
    }
);

module.exports = mongoose.model("Expense", expenseSchema);