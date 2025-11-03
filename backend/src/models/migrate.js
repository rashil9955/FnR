import { ensureDatabase, db } from './db.js';

ensureDatabase()
  .then(() => {
    console.log('Migration complete');
    return db.destroy();
  })
  .catch((err) => {
    console.error('Migration failed', err);
    process.exit(1);
  });
