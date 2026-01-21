import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import prisma from '../db';

describe('Authentication API Endpoints', () => {
  let isDatabaseAvailable = false;

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      isDatabaseAvailable = true;
    } catch (error) {
      console.warn('Database not available, skipping integration tests');
      isDatabaseAvailable = false;
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      if (!isDatabaseAvailable) return;

      const uniqueEmail = `test-${Date.now()}@example.com`;
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: 'password123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(uniqueEmail);
      expect(response.body.user.role).toBe('user');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    it('should reject registration with missing email', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Email and password are required');
    });

    it('should reject registration with missing password', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Email and password are required');
    });

    it('should reject registration with invalid email format', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Invalid email format');
      expect(response.body.error.field).toBe('email');
    });

    it('should reject registration with short password', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '12345',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Password must be at least 6 characters');
      expect(response.body.error.field).toBe('password');
    });

    it('should reject registration with duplicate email', async () => {
      if (!isDatabaseAvailable) return;

      const uniqueEmail = `duplicate-${Date.now()}@example.com`;
      
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: 'password123',
        })
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: 'password456',
        })
        .expect(409);

      expect(response.body.error.code).toBe('USER_EXISTS');
      expect(response.body.error.message).toContain('User with this email already exists');
      expect(response.body.error.field).toBe('email');
    });
  });

  describe('POST /api/auth/login', () => {
    const testEmail = `login-test-${Date.now()}@example.com`;
    const testPassword = 'password123';

    beforeAll(async () => {
      if (!isDatabaseAvailable) return;

      // Create a test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
        });
    });

    it('should login with valid credentials and return JWT', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user.role).toBe('user');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    it('should reject login with invalid email', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('should reject login with missing email', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: testPassword,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Email and password are required');
    });

    it('should reject login with missing password', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Email and password are required');
    });
  });
});
