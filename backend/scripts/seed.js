import '../src/config/env.js';
import { db, ensureDatabase } from '../src/models/db.js';
import bcrypt from 'bcryptjs';
import { callRiskService } from '../src/services/riskService.js';

const users = [
  { email: 'user1@example.com', name: 'Demo User 1' },
  { email: 'user2@example.com', name: 'Demo User 2' },
];

async function main() {
  await ensureDatabase();
  await db('flags').del();
  await db('transactions').del();
  await db('accounts').del();
  await db('plaid_items').del();
  await db('users').del();

  for (const user of users) {
    const password = await bcrypt.hash('password', 10);
    const [created] = await db('users')
      .insert({ ...user, hashed_password: password })
      .returning('*');
    const accountId = await createDemoAccount(created.id);
    await generateTransactions(created.id, accountId);
  }

  console.log('Seed complete');
  await db.destroy();
}

async function createDemoAccount(userId) {
  const [account] = await db('accounts')
    .insert({ user_id: userId, account_id: `demo-${userId}`, name: 'Demo Checking', type: 'depository', subtype: 'checking' })
    .returning('*');
  return account.id;
}

async function generateTransactions(userId, accountId) {
  const merchants = ['Coffee Hut', 'Grocery Co', 'RideShare', 'Electronics Hub'];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const merchant = merchants[i % merchants.length];
    const amount = merchant === 'Electronics Hub' && i % 10 === 0 ? 420.5 : Math.round(Math.random() * 50 * 100) / 100;
    const tx = {
      tx_id: `demo-${userId}-${i}`,
      user_id: userId,
      account_id: accountId,
      amount,
      date: date.toISOString().slice(0, 10),
      merchant_name: merchant,
      category: ['Shops'],
      transaction_type: 'place',
      raw: { merchant, amount },
    };
    const history = await db('transactions')
      .where({ user_id: userId })
      .orderBy('date', 'desc')
      .limit(20);
    const risk = await callRiskService({ userId, transaction: tx, history });
    const isFlagged = (risk?.score ?? 0) >= 75;
    const [created] = await db('transactions')
      .insert({ ...tx, risk_score: risk?.score ?? 0, is_flagged: isFlagged, flagged_at: isFlagged ? new Date() : null, explanation: risk?.explanation || null })
      .returning('*');
    if (isFlagged) {
      await db('flags').insert({
        transaction_id: created.id,
        user_id: userId,
        flag_type: 'seeded_flag',
        metadata: { score: created.risk_score },
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
