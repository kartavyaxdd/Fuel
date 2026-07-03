import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import dashboardRoutes from './routes/dashboard';
import foodRoutes from './routes/food';
import weightRoutes from './routes/weight';
import insightsRoutes from './routes/insights';
import progressRoutes from './routes/progress';
import goalRoutes from './routes/goal';
import coachRoutes from './routes/coach';

// Load environment variables
dotenv.config();

const app: Express = express();

// CORS configuration
const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: [frontendURL, 'https://fuel-2j8v.onrender.com'].filter(Boolean),
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', dashboardRoutes);
app.use('/api', foodRoutes);
app.use('/api', weightRoutes);
app.use('/api', insightsRoutes);
app.use('/api', progressRoutes);
app.use('/api', goalRoutes);
app.use('/api', coachRoutes);

// Root endpoint — shows API is alive
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'Fuel API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/openapi.json',
    endpoints: {
      dashboard: '/api/dashboard',
      food: '/api/food/search?q=',
      weight: '/api/weight',
      insights: '/api/insights',
      progress: '/api/progress',
      goal: '/api/goal',
      coach: '/api/coach',
    },
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve OpenAPI spec for ChatGPT / API clients
app.get('/api/openapi.json', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'openapi.json'));
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
