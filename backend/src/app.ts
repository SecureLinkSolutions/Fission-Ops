import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import authRouter from './routes/auth';
import registerRouter from './routes/register';
import incidentsRouter from './routes/incidents';
import entitiesRouter from './routes/entities';
import entityStandaloneRouter from './routes/entityStandalone';
import killChainRouter from './routes/killChain';
import boundaryRouter, { entityBoundaryRouter } from './routes/boundaries';
import relationshipsRouter from './routes/relationships';
import boundaryVizRouter from './routes/boundaryVisualization';
import { ttpSearchRouter } from './routes/ttps';
import reportRouter from './routes/report';
import auditRouter from './routes/audit';
import usersRouter from './routes/users';
import organizationsRouter from './routes/organizations';
import superAdminRouter from './routes/superadmin';
import notificationsRouter from './routes/notifications';
import commentsRouter from './routes/comments';
import tasksRouter from './routes/tasks';
import executiveSummaryRouter from './routes/executiveSummary';
import pirRouter from './routes/pir';
import enrichmentRouter from './routes/enrichment';
import iocRouter from './routes/ioc';
import licenseRouter from './routes/license';
import searchRouter from './routes/search';
import tabletopRouter from './routes/tabletop';
import yaraRouter from './routes/yara';
import { requireFeature } from './middleware/featureGate';
import { errorHandler, notFound } from './middleware/errorHandler';
import { pool } from './db/pool';

const app = express();

// Liveness — process is up, no dependency checks
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness — confirms DB connectivity, for load balancer / orchestrator probes
app.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', db: 'disconnected' });
  }
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled — frontend served separately
}));

// CORS — support comma-separated origins in FRONTEND_URL
const allowedOrigins = config.FRONTEND_URL.split(',').map((s) => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// Rate limiting
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

app.use('/api/', globalLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/auth/reset-password', authLimiter);

const v1 = express.Router();

v1.use('/auth/sso', requireFeature('sso'));
v1.use('/auth', authRouter);
v1.use('/auth/register', registerRouter);
v1.use('/license', licenseRouter);
v1.use('/incidents', incidentsRouter);
v1.use('/incidents/:id/report', requireFeature('pdf_export'));
v1.use('/incidents', reportRouter);
v1.use('/incidents/:id/pir-report', requireFeature('pdf_export'));
v1.use('/incidents', pirRouter);
v1.use('/incidents/:incidentId/entities', entitiesRouter);
v1.use('/incidents/:incidentId/boundaries', boundaryRouter);
v1.use('/incidents/:incidentId/relationships', requireFeature('relationships'), relationshipsRouter);
v1.use('/incidents/:incidentId/boundary-viz', requireFeature('network_boundaries'), boundaryVizRouter);
v1.use('/entities', entityStandaloneRouter);
v1.use('/entities/:entityId/boundaries', entityBoundaryRouter);
v1.use('/ttps', ttpSearchRouter);
v1.use('/audit', requireFeature('audit_log'), auditRouter);
v1.use('/users', usersRouter);
v1.use('/organizations', requireFeature('multi_tenancy'), organizationsRouter);
v1.use('/superadmin', superAdminRouter);
v1.use('/', killChainRouter);
v1.use('/notifications', notificationsRouter);
v1.use('/', commentsRouter);
v1.use('/', tasksRouter);
v1.use('/', executiveSummaryRouter);
v1.use('/entities/:entityId/enrich', requireFeature('threat_intelligence'));
v1.use('/', enrichmentRouter);
v1.use('/', iocRouter);
v1.use('/search', searchRouter);
v1.use('/tabletop', tabletopRouter);
v1.use('/', yaraRouter);

app.use('/api/v1', v1);
app.use(notFound);
app.use(errorHandler);

export default app;
