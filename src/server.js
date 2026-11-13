const { openDb } = require('./db');
const { createApp } = require('./app');

// Loads .env if it exists (built into Node 22, no dotenv needed).
try {
  process.loadEnvFile();
} catch {
  // No .env: use the defaults below.
}

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DATABASE_PATH || './data/convocadas.db';

const db = openDb(dbPath);
createApp(db).listen(port, () => {
  console.log(`Convocadas listening on http://localhost:${port}`);
});
