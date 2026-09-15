import express from 'express';
import cors from 'cors';
import { config } from './config';
import { initDb, waitForDb } from './db';
import { streamManager } from './stream/manager';
import { startRetentionJob } from './stream/retention';
import authRoutes from './routes/auth';
import cameraRoutes from './routes/cameras';
import recordingRoutes from './routes/recordings';
import eventRoutes from './routes/events';

async function main() {
  await waitForDb();
  await initDb();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/cameras', cameraRoutes);
  app.use('/api/recordings', recordingRoutes);
  app.use('/api/events', eventRoutes);

  // Khởi động worker cho các camera đang bật
  await streamManager.bootstrap();
  const retentionTimer = startRetentionJob();

  const server = app.listen(config.port, () => {
    console.log(`[backend] listening on :${config.port}`);
  });

  const shutdown = () => {
    console.log('[backend] shutting down...');
    clearInterval(retentionTimer);
    streamManager.stopAll();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[backend] fatal:', err);
  process.exit(1);
});
