import express from "express";

import { registerUser, loginUser } from "../controllers/user.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", authMiddleware, loginUser);

export default router;