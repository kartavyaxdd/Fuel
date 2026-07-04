import app from './server';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { loadAll, flushNow } from './domain/store';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);

if (require.main === module) {
  loadAll().then(() => {
    // Rate limiting — prevent abuse on free tier
    app.use('/api', rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Try again in a minute.' },
    }));

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Rate limit: 60 req/min per /api route`);
      console.log('Routes:');
      const routes = [
        'GET  /', 'GET  /health', 'GET  /api/openapi.json',
        'GET  /api/dashboard',
        'GET  /api/food/search', 'POST /api/food/log', 'DELETE /api/food/log', 'POST /api/food/analyze-photo',
        'POST /api/food/barcode', 'GET  /api/food/recent',
        'GET  /api/weight', 'POST /api/weight',
        'GET  /api/insights',
        'GET  /api/progress',
        'GET  /api/goal', 'POST /api/goal',
        'POST /api/coach/chat', 'POST /api/coach/chat/sync',
        'POST /api/reset',
        'GET  /api/export',
        'GET  /api/measurements', 'POST /api/measurements',
        'GET  /api/training-day', 'POST /api/training-day',
        'POST /api/user/register', 'GET  /api/user',
      ];
      routes.forEach(r => console.log(`  ${r}`));
    });

    // Flush pending writes on graceful shutdown so nothing is lost on restart.
    const shutdown = async () => {
      await flushNow();
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}

export default app;
