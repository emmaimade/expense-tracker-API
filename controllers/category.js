import Category from "../models/Category.js";
import Expense from "../models/Expense.js";

// Add a new category
const addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    if (name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: "Category name must be between 2 and 50 characters",
      });
    }

    // Check if category with same name exists for this user or is a default category
    const existingCategory = await Category.findOne({
      $or: [
        { userId: userId, name: { $regex: `^${name.trim()}$`, $options: "i" } }, // User-specific
        {
          userId: null,
          isDefault: true,
          name: { $regex: `^${name.trim()}$`, $options: "i" },
        }, // Default
      ],
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: existingCategory.userId
          ? "Category already exists"
          : "Cannot create a category that matches a default category",
      });
    }

    const category = await Category.create({
      name: name.trim(),
      userId: userId,
      isDefault: false,
    });

    return res.status(201).json({
      success: true,
      message: "Category added successfully",
      data: {
        id: category._id,
        name: category.name,
      },
    });
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).json({
      success: false,
      message: "Failed to add category",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Get categories
const getCategories = async (req, res) => {
  try {
    const userId = req.user.id;

    const categories = await Category.find({
      $or: [
        { userId: userId, isDefault: false }, // User-specific
        { userId: null, isDefault: true }, // Default
      ],
    }).sort({ isDefault: -1, name: 1 }); // Default categories first, then alphabetically

    res.status(200).json({
      success: true,
      messageg: "Categories retrieved successfully",
      data: categories,
      counts: {
        total: categories.length,
        default: categories.filter((cat) => cat.isDefault).length,
        custom: categories.filter((cat) => !cat.isDefault).length,
      },
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    if (name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: "Category name must be between 2 and 50 characters",
      });
    }

    const category = await Category.findOne({
      _id: id,
      userId: userId,
      isDefault: false,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found or cannot be updated",
      });
    }

    // Check if new name conflicts with existing categories
    const trimmedName = name.trim();
    if (category.name.toLowerCase() !== trimmedName.toLowerCase()) {
      const existingCategory = await Category.findOne({
        _id: { $ne: id },
        $or: [
          {
            userId: userId,
            name: { $regex: `^${trimmedName}$`, $options: "i" },
          }, // User-specific
          {
            userId: null,
            isDefault: true,
            name: { $regex: `^${trimmedName}$`, $options: "i" },
          }, // Default
        ],
      });

      if (existingCategory) {
        const categoryType = existingCategory.isDefault ? "default" : "custom";
        return res.status(409).json({
          success: false,
          message: `Category name '${trimmedName}' already exists as a ${categoryType} category`,
        });
      }
    }

    // Update category name
    const updatedCategory = await Category.findOneAndUpdate(
      { _id: id, userId: userId, isDefault: false }, // filter
      { name: trimmedName }, // update
      { new: true, runValidators: true } // options
    );

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: {
        id: updatedCategory._id,
        name: updatedCategory.name,
      },
    });
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    const userId = req.user.id;

    // Check if category exists
    const category = await Category.findOne({ _id: id, userId: userId });
    if (!category || category.isDefault) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete this category",
      });
    }

    // Check if category has any expenses
    const expenseCount = await Expense.countDocuments({
      category: id,
      userId: userId,
    });

    if (expenseCount > 0 && !force) {
      return res.status(409).json({
        success: false,
        message: `Category is used by ${expenseCount} expenses`,
        options: {
          forceDelete: `DELETE /category/${id}?force=true`,
        },
      });
    }

    if (force) {
      const othersCategory = await Category.findOne({
        name: "Others",
        isDefault: true,
      });

      // Move expenses to "Others" category
      await Expense.updateMany(
        { category: id, userId: userId },
        { category: othersCategory._id }
      );
    }

    // Delete category
    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: force
        ? `Category ${category.name} deleted. ${expenseCount} expenses moved to 'Others'.`
        : `Category ${category.name} deleted successfully`,
    });
  } catch (err) {
    console.log("Error deleting category:", err);

    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: err.message,
    });
  }
};

export { addCategory, getCategories, updateCategory, deleteCategory };
