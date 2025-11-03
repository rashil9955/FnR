import { db } from '../models/db.js';
import { callRiskService } from '../services/riskService.js';
import { config } from '../config/env.js';

export async function processPendingTransactions(limit = 20) {
  const pending = await db('transactions')
    .whereNull('risk_score')
    .orderBy('created_at', 'asc')
    .limit(limit);
  for (const tx of pending) {
    const history = await db('transactions')
      .where({ user_id: tx.user_id })
      .andWhere('date', '<', tx.date)
      .orderBy('date', 'desc')
      .limit(50);
    const risk = await callRiskService({ userId: tx.user_id, transaction: tx, history });
    const isFlagged = (risk?.score ?? 0) >= config.riskFlagThreshold;
    await db('transactions')
      .where({ id: tx.id })
      .update({ risk_score: risk?.score ?? 0, explanation: risk?.explanation || null, is_flagged: isFlagged });
  }
}
