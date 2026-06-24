import './config/env';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import dataRoutes from './routes/data.routes';
import { seedIfEmpty } from './services/seed.service';

const app = express();
const PORT = process.env.PORT || 5096;

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

const normalize = (u?: string) => (u ? u.replace(/\/+$/g, '').trim() : undefined);
const allowedOrigins = [
  normalize(process.env.FRONTEND_URL),
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(normalize) : []),
].filter(Boolean) as string[];

const isDev = process.env.NODE_ENV !== 'production';

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (isDev) return callback(null, true);
      const normalizedOrigin = normalize(origin) as string;
      if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (req.method === 'OPTIONS') return next();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Only POST is allowed on API routes' });
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Dairy API' });
});

app.post('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/data', dataRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: 'Internal server error', details: message });
});

app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`Dairy API listening on port ${PORT}`);
  try {
    await seedIfEmpty();
  } catch (err) {
    console.error('[Seed] Startup seed failed:', err);
  }
});

export default app;
