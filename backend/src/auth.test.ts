import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { registerUser, loginUser, verifyToken, generateToken, authenticateToken, requireAdmin } from './auth';
import prisma from './db';
import { Request, Response } from 'express';
import { AuthRequest } from './auth';

describe('Authentication System', () => {
  let isDatabaseAvailable = false;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'password123';

  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      isDatabaseAvailable = true;
    } catch (error) {
      console.warn('Database not available for testing. Skipping authentication tests.');
      isDatabaseAvailable = false;
    }
  });

  afterAll(async () => {
    // Clean up test users
    if (isDatabaseAvailable) {
      try {
        await prisma.user.deleteMany({
          where: {
            email: {
              startsWith: 'test-',
            },
          },
        });
      } catch (error) {
        console.warn('Error cleaning up test users:', error);
      }
    }
    await prisma.$disconnect();
  });

  describe('User Registration', () => {
    it.skipIf(!isDatabaseAvailable)('should register a new user with valid inputs', async () => {
      const email = `test-register-${Date.now()}@example.com`;
      const password = 'validPassword123';

      const result = await registerUser(email, password);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.user.role).toBe('user');
      expect(result.user.id).toBeDefined();
    });

    it.skipIf(!isDatabaseAvailable)('should hash the password', async () => {
      const email = `test-hash-${Date.now()}@example.com`;
      const password = 'mySecretPassword';

      await registerUser(email, password);

      const user = await prisma.user.findUnique({
        where: { email },
      });

      expect(user).toBeDefined();
      expect(user!.passwordHash).toBeDefined();
      expect(user!.passwordHash).not.toBe(password);
    });

    it.skipIf(!isDatabaseAvailable)('should reject duplicate email registration', async () => {
      const email = `test-duplicate-${Date.now()}@example.com`;
      const password = 'password123';

      await registerUser(email, password);

      await expect(registerUser(email, password)).rejects.toThrow('USER_EXISTS');
    });

    it.skipIf(!isDatabaseAvailable)('should allow registering admin users', async () => {
      const email = `test-admin-${Date.now()}@example.com`;
      const password = 'adminPassword123';

      const result = await registerUser(email, password, 'admin');

      expect(result.user.role).toBe('admin');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      if (isDatabaseAvailable) {
        // Ensure test user exists
        try {
          await registerUser(testEmail, testPassword);
        } catch (error) {
          // User might already exist from previous test
        }
      }
    });

    it.skipIf(!isDatabaseAvailable)('should login with valid credentials and return JWT', async () => {
      const result = await loginUser(testEmail, testPassword);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testEmail);
    });

    it.skipIf(!isDatabaseAvailable)('should fail login with invalid email', async () => {
      const invalidEmail = 'nonexistent@example.com';

      await expect(loginUser(invalidEmail, testPassword)).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it.skipIf(!isDatabaseAvailable)('should fail login with invalid password', async () => {
      const invalidPassword = 'wrongPassword';

      await expect(loginUser(testEmail, invalidPassword)).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it.skipIf(!isDatabaseAvailable)('should return valid JWT token that can be verified', async () => {
      const result = await loginUser(testEmail, testPassword);
      const decoded = verifyToken(result.token);

      expect(decoded).toBeDefined();
      expect(decoded.email).toBe(testEmail);
      expect(decoded.userId).toBeDefined();
      expect(decoded.role).toBeDefined();
    });
  });

  describe('JWT Token Operations', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        userId: '123',
        email: 'test@example.com',
        role: 'user' as const,
      };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify a valid token', () => {
      const payload = {
        userId: '123',
        email: 'test@example.com',
        role: 'user' as const,
      };

      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should reject an invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow('AUTH_INVALID');
    });

    it('should reject a malformed token', () => {
      const malformedToken = 'not-a-jwt-token';

      expect(() => verifyToken(malformedToken)).toThrow('AUTH_INVALID');
    });
  });

  describe('JWT Verification Middleware', () => {
    it('should reject requests without token', () => {
      const req = {
        headers: {},
        path: '/test',
      } as AuthRequest;

      const res = {
        status: (code: number) => ({
          json: (data: any) => {
            expect(code).toBe(401);
            expect(data.error.code).toBe('AUTH_REQUIRED');
          },
        }),
      } as unknown as Response;

      const next = () => {
        throw new Error('Next should not be called');
      };

      authenticateToken(req, res, next);
    });

    it('should reject requests with invalid token', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid.token.here',
        },
        path: '/test',
      } as AuthRequest;

      const res = {
        status: (code: number) => ({
          json: (data: any) => {
            expect(code).toBe(401);
            expect(data.error.code).toBe('AUTH_INVALID');
          },
        }),
      } as unknown as Response;

      const next = () => {
        throw new Error('Next should not be called');
      };

      authenticateToken(req, res, next);
    });

    it('should accept requests with valid token', () => {
      const payload = {
        userId: '123',
        email: 'test@example.com',
        role: 'user' as const,
      };
      const token = generateToken(payload);

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        path: '/test',
      } as AuthRequest;

      const res = {} as Response;

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      authenticateToken(req, res, next);

      expect(nextCalled).toBe(true);
      expect(req.user).toBeDefined();
      expect(req.user?.userId).toBe(payload.userId);
      expect(req.user?.email).toBe(payload.email);
      expect(req.user?.role).toBe(payload.role);
    });
  });

  describe('Admin Authorization Middleware', () => {
    it('should reject requests without user', () => {
      const req = {
        path: '/test',
      } as AuthRequest;

      const res = {
        status: (code: number) => ({
          json: (data: any) => {
            expect(code).toBe(401);
            expect(data.error.code).toBe('AUTH_REQUIRED');
          },
        }),
      } as unknown as Response;

      const next = () => {
        throw new Error('Next should not be called');
      };

      requireAdmin(req, res, next);
    });

    it('should reject non-admin users', () => {
      const req = {
        user: {
          userId: '123',
          email: 'user@example.com',
          role: 'user' as const,
        },
        path: '/test',
      } as AuthRequest;

      const res = {
        status: (code: number) => ({
          json: (data: any) => {
            expect(code).toBe(403);
            expect(data.error.code).toBe('ADMIN_REQUIRED');
          },
        }),
      } as unknown as Response;

      const next = () => {
        throw new Error('Next should not be called');
      };

      requireAdmin(req, res, next);
    });

    it('should accept admin users', () => {
      const req = {
        user: {
          userId: '123',
          email: 'admin@example.com',
          role: 'admin' as const,
        },
        path: '/test',
      } as AuthRequest;

      const res = {} as Response;

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      requireAdmin(req, res, next);

      expect(nextCalled).toBe(true);
    });
  });
});
