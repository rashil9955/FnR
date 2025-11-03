import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: process.env.ENV_FILE || '.env' });
}

export const config = {
  plaid: {
    clientId: process.env.PLAID_CLIENT_ID || '',
    secret: process.env.PLAID_SECRET || '',
    env: process.env.PLAID_ENV || 'sandbox',
    products: (process.env.PLAID_PRODUCTS || 'transactions').split(','),
  },
  jwtSecret: process.env.JWT_SECRET || 'devsecret',
  dbUrl: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/frauddb',
  redisUrl: process.env.REDIS_URL || null,
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000',
  riskFlagThreshold: Number(process.env.RISK_FLAG_THRESHOLD || 75),
};

export default config;
