import express from 'express';

import {
  addCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} from '../controllers/category.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all category routes
router.use(authMiddleware);

router.get('/', getCategories);
router.post('/', addCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;