import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { json } from 'express';
import plaidRouter from './routes/plaid.js';
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';
import adminRouter from './routes/admin.js';

const app = express();
app.use(cors());
app.use(json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/plaid', plaidRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/admin', adminRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

export default app;
