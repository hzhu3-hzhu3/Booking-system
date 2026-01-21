import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { authenticateToken, generateToken, requireAdmin } from './auth';
import { Response } from 'express';
import { AuthRequest } from './auth';

// Feature: breakout-room-booking, Property 1: Unauthenticated requests are rejected
// Validates: Requirements 1.1

// Feature: breakout-room-booking, Property 2: Non-admin users cannot perform admin actions
// Validates: Requirements 1.3

describe('Authentication Property Tests', () => {
  describe('Property 1: Unauthenticated requests are rejected', () => {
    it('should reject any request without a valid authentication token', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various invalid token scenarios
          fc.oneof(
            fc.constant(undefined), // No authorization header
            fc.constant(''), // Empty authorization header
            fc.string(), // Random string as token
            fc.constant('Bearer'), // Bearer without token
            fc.constant('InvalidPrefix token'), // Wrong prefix
            fc.string().map(s => `Bearer ${s}`), // Bearer with random invalid token
          ),
          async (authHeader) => {
            const req = {
              headers: authHeader ? { authorization: authHeader } : {},
              path: '/test-endpoint',
            } as AuthRequest;

            let statusCode: number | undefined;
            let responseData: any;

            const res = {
              status: (code: number) => ({
                json: (data: any) => {
                  statusCode = code;
                  responseData = data;
                  return res;
                },
              }),
            } as unknown as Response;

            let nextCalled = false;
            const next = () => {
              nextCalled = true;
            };

            authenticateToken(req, res, next);

            // Property: All invalid/missing tokens should result in 401 status
            expect(statusCode).toBe(401);
            expect(nextCalled).toBe(false);
            expect(responseData).toBeDefined();
            expect(responseData.error).toBeDefined();
            expect(responseData.error.code).toMatch(/AUTH_REQUIRED|AUTH_INVALID/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept any request with a valid authentication token', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid user payloads
          fc.record({
            userId: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constantFrom('user' as const, 'admin' as const),
          }),
          async (payload) => {
            const token = generateToken(payload);
            
            const req = {
              headers: {
                authorization: `Bearer ${token}`,
              },
              path: '/test-endpoint',
            } as AuthRequest;

            const res = {
              status: () => {
                throw new Error('Status should not be called for valid tokens');
              },
            } as unknown as Response;

            let nextCalled = false;
            const next = () => {
              nextCalled = true;
            };

            authenticateToken(req, res, next);

            // Property: All valid tokens should pass authentication
            expect(nextCalled).toBe(true);
            expect(req.user).toBeDefined();
            expect(req.user?.userId).toBe(payload.userId);
            expect(req.user?.email).toBe(payload.email);
            expect(req.user?.role).toBe(payload.role);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject requests with malformed Bearer tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate malformed Bearer tokens (non-empty tokens after Bearer)
          fc.oneof(
            fc.string().filter(s => s.length > 0 && s.trim().length > 0).map(s => `Bearer ${s}.${s}`), // Two-part token
            fc.string().filter(s => s.length > 0 && s.trim().length > 0).map(s => `Bearer ${s}.${s}.${s}.${s}`), // Four-part token
            fc.string().filter(s => s.length > 0 && s.trim().length > 0 && !s.includes('.')).map(s => `Bearer ${s}`), // No dots
          ),
          async (authHeader) => {
            const req = {
              headers: { authorization: authHeader },
              path: '/test-endpoint',
            } as AuthRequest;

            let statusCode: number | undefined;
            let responseData: any;

            const res = {
              status: (code: number) => ({
                json: (data: any) => {
                  statusCode = code;
                  responseData = data;
                  return res;
                },
              }),
            } as unknown as Response;

            let nextCalled = false;
            const next = () => {
              nextCalled = true;
            };

            authenticateToken(req, res, next);

            // Property: All malformed tokens should be rejected with 401
            expect(statusCode).toBe(401);
            expect(nextCalled).toBe(false);
            // Can be AUTH_REQUIRED (empty token) or AUTH_INVALID (malformed token)
            expect(responseData.error.code).toMatch(/AUTH_REQUIRED|AUTH_INVALID|AUTH_EXPIRED/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Non-admin users cannot perform admin actions', () => {
    it('should reject any non-admin user attempting admin actions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate non-admin user payloads
          fc.record({
            userId: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constant('user' as const), // Always 'user' role
          }),
          async (payload) => {
            const req = {
              user: payload,
              path: '/admin/test-endpoint',
            } as AuthRequest;

            let statusCode: number | undefined;
            let responseData: any;

            const res = {
              status: (code: number) => ({
                json: (data: any) => {
                  statusCode = code;
                  responseData = data;
                  return res;
                },
              }),
            } as unknown as Response;

            let nextCalled = false;
            const next = () => {
              nextCalled = true;
            };

            requireAdmin(req, res, next);

            // Property: All non-admin users should be rejected with 403
            expect(statusCode).toBe(403);
            expect(nextCalled).toBe(false);
            expect(responseData).toBeDefined();
            expect(responseData.error).toBeDefined();
            expect(responseData.error.code).toBe('ADMIN_REQUIRED');
            expect(responseData.error.message).toContain('Admin');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept any admin user attempting admin actions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate admin user payloads
          fc.record({
            userId: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constant('admin' as const), // Always 'admin' role
          }),
          async (payload) => {
            const req = {
              user: payload,
              path: '/admin/test-endpoint',
            } as AuthRequest;

            const res = {
              status: () => {
                throw new Error('Status should not be called for admin users');
              },
            } as unknown as Response;

            let nextCalled = false;
            const next = () => {
              nextCalled = true;
            };

            requireAdmin(req, res, next);

            // Property: All admin users should pass authorization
            expect(nextCalled).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject requests without user context', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various paths
          fc.string().filter(s => s.length > 0),
          async (path) => {
            const req = {
              path: path,
              // No user property set
            } as AuthRequest;

            let statusCode: number | undefined;
            let responseData: any;

            const res = {
              status: (code: number) => ({
                json: (data: any) => {
                  statusCode = code;
                  responseData = data;
                  return res;
                },
              }),
            } as unknown as Response;

            let nextCalled = false;
            const next = () => {
              nextCalled = true;
            };

            requireAdmin(req, res, next);

            // Property: Requests without user context should be rejected with 401
            expect(statusCode).toBe(401);
            expect(nextCalled).toBe(false);
            expect(responseData).toBeDefined();
            expect(responseData.error).toBeDefined();
            expect(responseData.error.code).toBe('AUTH_REQUIRED');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
