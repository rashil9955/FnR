import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { requireAdmin } from '../middleware/auth.js';
import { db } from '../models/db.js';
import { config } from '../config/env.js';

const router = Router();

router.use(requireAdmin);

router.get(
  '/flags',
  asyncHandler(async (req, res) => {
    const flags = await db('transactions')
      .where({ is_flagged: true })
      .orderBy('flagged_at', 'desc')
      .limit(200);
    res.json({ flags });
  })
);

router.post(
  '/threshold',
  asyncHandler(async (req, res) => {
    const { threshold } = req.body;
    config.riskFlagThreshold = Number(threshold);
    res.json({ threshold: config.riskFlagThreshold });
  })
);

export default router;
