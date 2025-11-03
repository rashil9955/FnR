import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { requireAuth } from '../middleware/auth.js';
import { ingestTransactions, listTransactions, recordDecision } from '../services/transactionService.js';
import { callRiskService } from '../services/riskService.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const transactions = await listTransactions(req.user.id);
    res.json({ transactions });
  })
);

router.post(
  '/ingest',
  asyncHandler(async (req, res) => {
    const { transactions } = req.body;
    const ingested = await ingestTransactions(req.user.id, transactions);
    res.status(201).json({ transactions: ingested });
  })
);

router.post(
  '/:id/decision',
  asyncHandler(async (req, res) => {
    const { decision } = req.body;
    const tx = await recordDecision(req.user.id, req.params.id, decision);
    res.json({ transaction: tx });
  })
);

router.post(
  '/:id/score',
  asyncHandler(async (req, res) => {
    const { transaction, history } = req.body;
    const result = await callRiskService({ userId: req.user.id, transaction, history });
    res.json(result);
  })
);

export default router;
