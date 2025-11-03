#!/usr/bin/env node
const { randomUUID } = require('crypto');

const API_BASE = process.env.API_BASE || 'http://localhost:4000/api';
const TOKEN = process.env.API_TOKEN || '';

function buildTransaction(userId, idx) {
  const merchants = ['Coffee Hut', 'Electronics Hub', 'TravelNow', 'Grocery Co'];
  const merchant = merchants[idx % merchants.length];
  const isFraud = idx % 7 === 0;
  const amount = isFraud ? 350 + Math.random() * 400 : Math.random() * 80;
  const date = new Date();
  date.setDate(date.getDate() - idx);
  return {
    transaction_id: randomUUID(),
    account_id: `synthetic-account-${userId}`,
    amount: Number(amount.toFixed(2)),
    date: date.toISOString().slice(0, 10),
    merchant_name: merchant,
    category: isFraud ? ['Travel'] : ['Restaurants'],
    payment_channel: isFraud ? 'online' : 'in_store',
  };
}

async function run() {
  const userId = process.env.USER_ID || 'synthetic-user';
  const transactions = Array.from({ length: 20 }, (_, idx) => buildTransaction(userId, idx));
  const res = await fetch(`${API_BASE}/transactions/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify({ transactions }),
  });
  if (!res.ok) {
    throw new Error(`API responded with ${res.status}`);
  }
  const body = await res.json();
  console.log('Seeded transactions:', body.transactions?.length || 0);
}

run().catch((err) => {
  console.error('Failed to seed synthetic data', err.message);
  process.exit(1);
});
