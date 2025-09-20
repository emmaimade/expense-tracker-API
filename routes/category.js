import express from 'express';

import {
  addCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} from '../controllers/category.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getCategories);
router.post('/', authMiddleware, addCategory);
router.put('/:id', authMiddleware, updateCategory);
router.delete('/:id', authMiddleware, deleteCategory);

export default router;