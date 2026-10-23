import Category from "../models/Category.js";

// ========================================
// DEFAULT CATEGORIES SETUP
// ========================================

// Default categories
const defaultCategories = [
  "Food",
  "Transportation",
  "Leisure",
  "Electronics",
  "Utilities",
  "Clothing",
  "Health",
  "Education",
  "Others",
];

export const createDefaultCategories = async () => {
  try {
    console.log('🏗️  Initializing default categories...');
    
    const existingDefaults = await Category.find({ userId: null, isDefault: true });
    const existingNames = existingDefaults.map((cat) => cat.name.toLowerCase().trim());

    for (const name of defaultCategories) {
      if (!existingNames.includes(name.toLowerCase().trim())) {
        await Category.create({
          name,
          userId: null,
          isDefault: true,
        });
        console.log(`Created default category: ${name}`);
      }
    }
  } catch (err) {
    console.error("Error creating default categories:", err);
  }
};

export default createDefaultCategories;
