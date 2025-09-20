import mongoose from 'mongoose';
import User from './User.js';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      minlength: 2,
      maxlength: 50,
      required: true,
      trim: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Ensure unique category names per user and for default categories
categorySchema.index({ name: 1, userId: 1 }, { unique: true });
categorySchema.index({ userId: 1, isDefault: 1, name: 1 });

const Category = mongoose.model('Category', categorySchema);

export default Category;