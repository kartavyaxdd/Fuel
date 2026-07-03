import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
  origin: frontendURL,
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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
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
