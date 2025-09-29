import express from 'express';

import {
  getBudgetOverview,
  getTotalMonthlyBudget,
  getBudgetTrends,
  setMonthlyBudget,
  getBudgetAlerts,
  deleteBudget
} from "../controllers/budgetController.js";
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all budget routes
router.use(authMiddleware);

// Budget endpoints
router.get('/overview', getBudgetOverview);
router.get('/total', getTotalMonthlyBudget);
router.get('/trends', getBudgetTrends);
router.get('/alerts', getBudgetAlerts);
router.post('/', setMonthlyBudget);
router.delete('/:id', deleteBudget);

export default router;