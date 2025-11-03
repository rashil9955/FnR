import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import asyncHandler from 'express-async-handler';
import { config } from '../config/env.js';
import { db } from '../models/db.js';
import { ingestTransactions } from './transactionService.js';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[config.plaid.env || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': config.plaid.clientId,
      'PLAID-SECRET': config.plaid.secret,
    },
  },
});

export const plaidClient = new PlaidApi(plaidConfig);

export const createLinkToken = asyncHandler(async (req, res) => {
  const user = req.user || { id: 'demo-user' };
  if (!config.plaid.clientId || !config.plaid.secret) {
    return res.json({ link_token: 'sandbox-link-token-demo', warning: 'PLAID_CLIENT_ID/PLAID_SECRET not set' });
  }
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: 'Fraud & Risk Platform',
    products: config.plaid.products,
    language: 'en',
    country_codes: ['US'],
  });
  res.json(response.data);
});

export const exchangePublicToken = asyncHandler(async (req, res) => {
  const { public_token } = req.body;
  if (!config.plaid.clientId || !config.plaid.secret) {
    const fakeTransactions = Array.from({ length: 5 }).map((_, idx) => ({
      transaction_id: `sandbox-${Date.now()}-${idx}`,
      account_id: 'demo-account',
      amount: Math.round((20 + Math.random() * 200) * 100) / 100,
      date: new Date(Date.now() - idx * 86400000).toISOString().slice(0, 10),
      merchant_name: ['Coffee Hut', 'Demo Travel', 'Electronics Hub'][idx % 3],
      category: idx % 2 ? ['Travel'] : ['Restaurants'],
      payment_channel: idx % 2 ? 'online' : 'in_store',
    }));
    await ingestTransactions(req.user?.id, fakeTransactions);
    return res.json({ item_id: 'sandbox-item', access_token: 'sandbox-access-token', transactions: fakeTransactions });
  }
  const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
  const access_token = exchangeResponse.data.access_token;
  const item_id = exchangeResponse.data.item_id;

  const userId = req.user?.id;
  const [item] = await db('plaid_items')
    .insert({ user_id: userId, item_id, access_token })
    .returning('*');

  const accountsResponse = await plaidClient.accountsGet({ access_token });
  for (const acct of accountsResponse.data.accounts) {
    await db('accounts')
      .insert({
        user_id: userId,
        plaid_item_id: item.id,
        account_id: acct.account_id,
        name: acct.name,
        mask: acct.mask,
        official_name: acct.official_name,
        type: acct.type,
        subtype: acct.subtype,
      })
      .onConflict('account_id')
      .merge();
  }

  await fetchAndIngestTransactions(access_token, userId);

  res.json({ item_id, access_token });
});

export async function fetchAndIngestTransactions(access_token, userId) {
  if (!config.plaid.clientId || !config.plaid.secret) {
    console.warn('Plaid credentials missing; skipping live transaction fetch.');
    return [];
  }
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);
  const endDate = new Date();
  const txResponse = await plaidClient.transactionsGet({
    access_token,
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
    options: { count: 100 },
  });
  const transactions = txResponse.data.transactions;
  await ingestTransactions(userId, transactions);
}

export const handleWebhook = asyncHandler(async (req, res) => {
  const { webhook_type, webhook_code, item_id } = req.body;
  console.log('Received Plaid webhook', webhook_type, webhook_code, item_id);
  const item = await db('plaid_items').where({ item_id }).first();
  if (!item) {
    return res.json({ status: 'ignored' });
  }
  if (['DEFAULT_UPDATE', 'INITIAL_UPDATE'].includes(webhook_code)) {
    await fetchAndIngestTransactions(item.access_token, item.user_id);
  }
  res.json({ status: 'ok' });
});
