const { openDb } = require('./db');
const { createApp } = require('./app');
const { createGeminiClient } = require('./ai');

// Loads .env if it exists (built into Node 22, no dotenv needed).
try {
  process.loadEnvFile();
} catch {
  // No .env: use the defaults below.
}

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DATABASE_PATH || './data/convocadas.db';

const ai = createGeminiClient({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || undefined,
});

const db = openDb(dbPath);
createApp(db, { ai }).listen(port, () => {
  console.log(`Convocadas listening on http://localhost:${port}`);
  console.log(ai.configured ? `AI suggestions enabled (model: ${ai.model})` : 'AI suggestions disabled: GEMINI_API_KEY is not set');
});
