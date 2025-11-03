import './config/env.js';
import app from './app.js';
import { ensureDatabase } from './models/db.js';

const PORT = process.env.PORT || 4000;

async function start() {
  await ensureDatabase();
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
