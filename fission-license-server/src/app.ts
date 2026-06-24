import 'express-async-errors';
import express from 'express';
import path from 'path';
import licenseRouter from './routes/licenses';
import adminRouter from './routes/admin';
import { getPublicKey } from './services/crypto';

const app = express();

app.use(express.json());

// Admin UI
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../src/admin-ui/index.html'));
});

// Public key endpoint
app.get('/public-key', (_req, res) => {
  res.json({ public_key: getPublicKey() });
});

// Routes
app.use('/licenses', licenseRouter);
app.use('/admin', adminRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = (err as { status?: number }).status ?? 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

export default app;
