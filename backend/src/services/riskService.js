import axios from 'axios';
import { config } from '../config/env.js';

export async function callRiskService({ userId, transaction, history }) {
  try {
    const response = await axios.post(`${config.mlServiceUrl}/score`, {
      user_id: userId,
      transaction,
      history,
    });
    return response.data;
  } catch (err) {
    console.error('Risk service unavailable, falling back to rule engine', err.message);
    return fallbackRuleEngine(transaction, history);
  }
}

function fallbackRuleEngine(transaction, history) {
  const amount = Number(transaction.amount || 0);
  if (amount < 5) {
    return { score: 5, explanation: { flags: ['micro-amount'], top_features: [] }, recommended_action: 'allow' };
  }
  const highAmount = amount > 200;
  const newMerchant = !history?.some((tx) => tx.merchant_name === transaction.merchant_name);
  const score = Math.min(100, (highAmount ? 60 : 20) + (newMerchant ? 30 : 0));
  const flags = [];
  if (highAmount) flags.push('high_amount');
  if (newMerchant) flags.push('new_merchant');
  return {
    score,
    explanation: { flags, top_features: flags.map((f) => ({ feature: f, weight: 0.2 })) },
    recommended_action: score >= config.riskFlagThreshold ? 'flag' : 'allow',
  };
}
