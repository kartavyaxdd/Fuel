import request from 'supertest';
import app from '../index';

describe('POST /api/user/register', () => {
  it('should create a new user and return userId', async () => {
    const res = await request(app).post('/api/user/register');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('should accept an optional username', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({ username: 'testuser' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('testuser');
  });

  it('should reject duplicate usernames', async () => {
    await request(app)
      .post('/api/user/register')
      .send({ username: 'dupuser' });
    const res = await request(app)
      .post('/api/user/register')
      .send({ username: 'dupuser' });
    expect(res.status).toBe(409);
  });

  it('should trim and lowercase username', async () => {
    await request(app)
      .post('/api/user/register')
      .send({ username: '  MixedCase  ' });
    const lookup = await request(app)
      .get('/api/user/lookup')
      .query({ username: 'mixedcase' });
    expect(lookup.status).toBe(200);
    expect(lookup.body.username).toBe('mixedcase');
  });

  it('should reject username shorter than 2 characters', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({ username: 'a' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/user', () => {
  it('should return 401 when no userId provided', async () => {
    const res = await request(app).get('/api/user');
    expect(res.status).toBe(401);
  });

  it('should return user info for valid userId', async () => {
    const reg = await request(app).post('/api/user/register');
    const userId = reg.body.userId;
    const res = await request(app).get('/api/user').query({ userId });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(userId);
  });

  it('should return 404 for unknown userId', async () => {
    const res = await request(app).get('/api/user').query({ userId: 'nonexistent' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/user/lookup', () => {
  it('should find a user by username', async () => {
    const reg = await request(app)
      .post('/api/user/register')
      .send({ username: 'lookmeup' });
    const userId = reg.body.userId;
    const res = await request(app)
      .get('/api/user/lookup')
      .query({ username: 'lookmeup' });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(userId);
    expect(res.body.username).toBe('lookmeup');
  });

  it('should return 404 for unknown username', async () => {
    const res = await request(app)
      .get('/api/user/lookup')
      .query({ username: 'doesnotexist' });
    expect(res.status).toBe(404);
  });

  it('should return 400 for missing username', async () => {
    const res = await request(app).get('/api/user/lookup');
    expect(res.status).toBe(400);
  });
});
