import request from 'supertest';
import { jest } from '@jest/globals';

const sampleTx = { id: 'tx1', amount: 100, risk_score: 80 };

let ingestMock;
let listMock;
let decisionMock;
let scoreMock;

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  ingestMock = jest.fn(async () => [sampleTx]);
  listMock = jest.fn(async () => [sampleTx]);
  decisionMock = jest.fn(async () => sampleTx);
  scoreMock = jest.fn(async () => ({ score: 50 }));

  await jest.unstable_mockModule('../middleware/auth.js', () => ({
    requireAuth: (req, res, next) => {
      req.user = { id: 'user-1', email: 'test@example.com' };
      next();
    },
  }));

  await jest.unstable_mockModule('../services/transactionService.js', () => ({
    ingestTransactions: ingestMock,
    listTransactions: listMock,
    recordDecision: decisionMock,
  }));

  await jest.unstable_mockModule('../services/riskService.js', () => ({
    callRiskService: scoreMock,
  }));
});

describe('App routes', () => {
  test('healthcheck works', async () => {
    const { default: app } = await import('../app.js');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('transactions ingestion route', async () => {
    const { default: app } = await import('../app.js');
    const res = await request(app)
      .post('/api/transactions/ingest')
      .send({ transactions: [{ amount: 100 }] });
    expect(res.status).toBe(201);
    expect(ingestMock).toHaveBeenCalled();
    expect(res.body.transactions[0].id).toBe('tx1');
  });

  test('decision endpoint', async () => {
    const { default: app } = await import('../app.js');
    const res = await request(app)
      .post('/api/transactions/tx123/decision')
      .send({ decision: 'approve' });
    expect(res.status).toBe(200);
    expect(decisionMock).toHaveBeenCalledWith('user-1', 'tx123', 'approve');
  });

  test('risk scoring passthrough', async () => {
    const { default: app } = await import('../app.js');
    const res = await request(app)
      .post('/api/transactions/tx123/score')
      .send({ transaction: { amount: 10 }, history: [] });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(50);
    expect(scoreMock).toHaveBeenCalled();
  });
});
