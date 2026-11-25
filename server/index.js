import path from 'node:path';
import { openDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 8090);
const DEMO_MODE = process.env.MISHKAH_DEMO_MODE === 'true';

const db = openDatabase(path.resolve(process.cwd(), 'data', 'mishkah.db'));
seedDatabase(db, { demoMode: DEMO_MODE });

const app = createApp(db, { demoMode: DEMO_MODE });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mishkah server running on http://localhost:${PORT} (demoMode=${DEMO_MODE})`);
});
