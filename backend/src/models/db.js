import knex from 'knex';
import { config } from '../config/env.js';

export const db = knex({
  client: 'pg',
  connection: config.dbUrl,
  pool: { min: 0, max: 10 },
  searchPath: ['public'],
});

export async function ensureDatabase() {
  await db.raw('select 1');
  await db.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await createTables();
}

async function createTables() {
  const hasUsers = await db.schema.hasTable('users');
  if (!hasUsers) {
    await db.schema.createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.string('email').notNullable().unique();
      table.string('name');
      table.string('hashed_password');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  const hasItems = await db.schema.hasTable('plaid_items');
  if (!hasItems) {
    await db.schema.createTable('plaid_items', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('item_id').notNullable();
      table.string('access_token').notNullable();
      table.jsonb('institution');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  const hasAccounts = await db.schema.hasTable('accounts');
  if (!hasAccounts) {
    await db.schema.createTable('accounts', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('plaid_item_id').references('id').inTable('plaid_items').onDelete('CASCADE');
      table.string('account_id').notNullable();
      table.string('name');
      table.string('mask');
      table.string('official_name');
      table.string('type');
      table.string('subtype');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.unique(['account_id']);
    });
  }

  const hasTransactions = await db.schema.hasTable('transactions');
  if (!hasTransactions) {
    await db.schema.createTable('transactions', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.string('tx_id').notNullable().unique();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('account_id').references('id').inTable('accounts').onDelete('CASCADE');
      table.decimal('amount', 14, 2).notNullable();
      table.date('date');
      table.string('merchant_name');
      table.specificType('category', 'text[]');
      table.string('transaction_type');
      table.jsonb('raw');
      table.integer('risk_score');
      table.boolean('is_flagged').defaultTo(false);
      table.timestamp('flagged_at');
      table.string('decision');
      table.timestamp('decision_at');
      table.jsonb('explanation');
      table.timestamps(true, true);
    });
  }

  const hasFlags = await db.schema.hasTable('flags');
  if (!hasFlags) {
    await db.schema.createTable('flags', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.uuid('transaction_id').references('id').inTable('transactions').onDelete('CASCADE');
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('flag_type');
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  }
}

export default db;
