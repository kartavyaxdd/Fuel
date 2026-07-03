import request from 'supertest';
import app from '../index';

describe('GET /api/dashboard', () => {
  it('should return 200 OK', async () => {
    const response = await request(app).get('/api/dashboard');
    expect(response.status).toBe(200);
  });

  it('should return the canonical DashboardData structure', async () => {
    const response = await request(app).get('/api/dashboard');
    const body = response.body;

    expect(body).toHaveProperty('date');
    expect(body).toHaveProperty('calories');
    expect(body).toHaveProperty('macros');
    expect(body).toHaveProperty('meals');
    expect(body).toHaveProperty('weightSeries');
    expect(body).toHaveProperty('energy');
    expect(body).toHaveProperty('weeklyAdherence');
    expect(body).toHaveProperty('goal');

    // Calories is a top-level MacroTarget.
    expect(body.calories).toHaveProperty('target');
    expect(body.calories).toHaveProperty('consumed');
    expect(body.calories).toHaveProperty('remaining');

    // Macros hold only protein/carbs/fat (calories is top-level).
    expect(body.macros).toHaveProperty('protein');
    expect(body.macros).toHaveProperty('carbs');
    expect(body.macros).toHaveProperty('fat');
    expect(body.macros).not.toHaveProperty('calories');

    // Adaptive energy model output.
    expect(body.energy).toHaveProperty('expenditureEstimate');
    expect(body.energy).toHaveProperty('confidence');
    expect(body.energy).toHaveProperty('trendDelta');
    expect(body.energy.confidence).toBeGreaterThanOrEqual(0);
    expect(body.energy.confidence).toBeLessThanOrEqual(1);

    // Goal projection.
    expect(body.goal).toHaveProperty('mode');
    expect(body.goal).toHaveProperty('progress');

    // Data types.
    expect(typeof body.date).toBe('string');
    expect(typeof body.weeklyAdherence).toBe('number');
    expect(Array.isArray(body.meals)).toBe(true);
    expect(Array.isArray(body.weightSeries)).toBe(true);
    expect(body.weightSeries.length).toBeGreaterThan(0);
  });
});
