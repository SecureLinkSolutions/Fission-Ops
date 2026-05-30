import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRouter from './routes/auth';
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
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();

app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));
app.use(express.json());

const v1 = express.Router();

v1.use('/auth', authRouter);
v1.use('/incidents', incidentsRouter);
v1.use('/incidents', reportRouter);
v1.use('/incidents/:incidentId/entities', entitiesRouter);
v1.use('/incidents/:incidentId/boundaries', boundaryRouter);
v1.use('/incidents/:incidentId/relationships', relationshipsRouter);
v1.use('/incidents/:incidentId/boundary-viz', boundaryVizRouter);
v1.use('/entities', entityStandaloneRouter);
v1.use('/entities/:entityId/boundaries', entityBoundaryRouter);
v1.use('/ttps', ttpSearchRouter);
v1.use('/audit', auditRouter);
v1.use('/users', usersRouter);
v1.use('/', killChainRouter);

app.use('/api/v1', v1);
app.use(notFound);
app.use(errorHandler);

export default app;
