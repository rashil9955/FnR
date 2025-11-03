import { db } from '../models/db.js';
import { callRiskService } from './riskService.js';
import { config } from '../config/env.js';

export async function ingestTransactions(userId, transactions) {
  if (!transactions?.length) return [];
  const normalized = await Promise.all(transactions.map((tx) => normalizeTransaction(userId, tx)));
  const inserted = [];
  for (const tx of normalized) {
    const existing = await db('transactions').where({ tx_id: tx.tx_id }).first();
    if (existing) continue;
    const history = await fetchRecentHistory(userId, tx.date, 50);
    const risk = await callRiskService({ userId, transaction: tx, history });
    const riskScore = risk?.score ?? 0;
    const isFlagged = riskScore >= config.riskFlagThreshold;
    const [created] = await db('transactions')
      .insert({
        ...tx,
        category: tx.category,
        raw: tx.raw,
        risk_score: riskScore,
        is_flagged: isFlagged,
        flagged_at: isFlagged ? new Date() : null,
        explanation: risk?.explanation || null,
      })
      .returning('*');
    if (isFlagged) {
      await db('flags').insert({
        transaction_id: created.id,
        user_id: userId,
        flag_type: 'risk',
        metadata: { score: riskScore, recommended_action: risk?.recommended_action },
      });
    }
    inserted.push(created);
  }
  return inserted;
}

export async function normalizeTransaction(userId, tx) {
  return {
    tx_id: tx.transaction_id || tx.tx_id,
    user_id: userId,
    account_id: await mapAccountId(userId, tx.account_id),
    amount: tx.amount,
    date: tx.date,
    merchant_name: tx.merchant_name || tx.name,
    category: tx.category || [],
    transaction_type: tx.transaction_type || tx.payment_channel,
    raw: tx,
  };
}

async function mapAccountId(userId, plaidAccountId) {
  if (!plaidAccountId) return null;
  const account = await db('accounts').where({ user_id: userId, account_id: plaidAccountId }).first();
  return account?.id || null;
}

async function fetchRecentHistory(userId, beforeDate, limit = 50) {
  return db('transactions')
    .where({ user_id: userId })
    .andWhere('date', '<', beforeDate)
    .orderBy('date', 'desc')
    .limit(limit);
}

export async function listTransactions(userId, { flaggedOnly = false } = {}) {
  let query = db('transactions').where({ user_id: userId }).orderBy('date', 'desc').limit(200);
  if (flaggedOnly) {
    query = query.andWhere({ is_flagged: true });
  }
  return await query;
}

export async function recordDecision(userId, transactionId, decision) {
  const [tx] = await db('transactions')
    .where({ id: transactionId, user_id: userId })
    .update({ decision, decision_at: new Date(), is_flagged: decision === 'decline' ? true : false })
    .returning('*');
  if (tx) {
    await db('flags').insert({
      transaction_id: tx.id,
      user_id: userId,
      flag_type: 'user_decision',
      metadata: { decision },
    });
  }
  return tx;
}
