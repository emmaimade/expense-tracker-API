import mongoose from 'mongoose';
import User from './User.js';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
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

// Ensure unique category names per user, allowing multiple users to have the same category name
categorySchema.index({ name: 1, userId: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;