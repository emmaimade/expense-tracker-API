import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Currency conversion fields
  amountOriginal: {
    type: Number,
    // The very first amount before any conversions
  },
  currencyOriginal: {
    type: String,
    uppercase: true,
    trim: true,
    // The original currency this expense was created in
  },
  conversionRate: {
    type: Number,
    // The rate used for the last conversion
  },
  convertedAt: {
    type: Date,
    // Timestamp of last conversion
  },
  convertedFrom: {
    type: String,
    uppercase: true,
    trim: true,
    // Currency it was converted from (for audit trail)
  },
  convertedTo: {
    type: String,
    uppercase: true,
    trim: true,
    // Currency it was converted to (for audit trail)
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for better query performance
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, currencyOriginal: 1 });

// Virtual to check if expense has been converted
expenseSchema.virtual('isConverted').get(function() {
  return !!this.amountOriginal && !!this.currencyOriginal;
});

// Method to get display information
expenseSchema.methods.getDisplayInfo = function() {
  return {
    id: this._id,
    amount: this.amount,
    description: this.description,
    date: this.date,
    category: this.category,
    isConverted: this.isConverted,
    originalAmount: this.amountOriginal,
    originalCurrency: this.currencyOriginal,
    conversionRate: this.conversionRate,
    convertedAt: this.convertedAt
  };
};

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;