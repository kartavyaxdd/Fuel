import app from './server';
import dotenv from 'dotenv';
import { loadAll, flushNow } from './domain/store';
import { seedDemoDay } from './domain/foodLog';
import { DEMO_ANCHOR_DATE } from './domain/sampleData';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);

// Start the server only if this file is run directly
if (require.main === module) {
  // Rehydrate persisted state before accepting traffic, then seed demo
  // data only if the store is empty (first-time user).
  loadAll().then(() => {
    seedDemoDay(DEMO_ANCHOR_DATE);

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
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
