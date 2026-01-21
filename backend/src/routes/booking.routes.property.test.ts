import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import app from '../index';
import prisma from '../db';
import { registerUser } from '../auth';

// Feature: breakout-room-booking
// Property 32: All-bookings endpoint supports filtering
// Validates: Requirements 14.4

describe('Booking Routes Property Tests - Admin Filtering', () => {
  let isDatabaseAvailable = false;
  let adminToken: string;
  let adminId: string;
  let testUsers: Array<{ id: string; token: string }> = [];
  let testRooms: Array<{ id: string; name: string }> = [];

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      isDatabaseAvailable = true;

      // Create admin user
      const adminResult = await registerUser(
        `admin-filter-test-${Date.now()}@example.com`,
        'password123',
        'admin'
      );
      adminToken = adminResult.token;
      adminId = adminResult.user.id;

      // Create test users
      for (let i = 0; i < 3; i++) {
        const userResult = await registerUser(
          `filter-test-user-${i}-${Date.now()}@example.com`,
          'password123'
        );
        testUsers.push({
          id: userResult.user.id,
          token: userResult.token,
        });
      }

      // Create test rooms
      for (let i = 0; i < 3; i++) {
        const room = await prisma.room.create({
          data: {
            name: `Filter Test Room ${i} ${Date.now()}`,
            capacity: 10,
            equipment: ['projector'],
            status: 'active',
          },
        });
        testRooms.push({
          id: room.id,
          name: room.name,
        });
      }

      // Create test bookings with various combinations
      const now = new Date();
      for (let i = 0; i < 10; i++) {
        const userIndex = i % testUsers.length;
        const roomIndex = i % testRooms.length;
        
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1 + i);
        tomorrow.setHours(10 + (i % 10), 0, 0, 0);
        const startAt = tomorrow;
        const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

        await prisma.booking.create({
          data: {
            userId: testUsers[userIndex].id,
            roomId: testRooms[roomIndex].id,
            startAt,
            endAt,
            status: 'confirmed',
          },
        });
      }
    } catch (error) {
      console.warn('Database not available, skipping property tests');
      isDatabaseAvailable = false;
    }
  });

  afterAll(async () => {
    if (isDatabaseAvailable) {
      // Clean up test data
      await prisma.booking.deleteMany({
        where: {
          userId: {
            in: testUsers.map(u => u.id),
          },
        },
      });

      await prisma.room.deleteMany({
        where: {
          id: {
            in: testRooms.map(r => r.id),
          },
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: [...testUsers.map(u => u.id), adminId],
          },
        },
      });
    }

    await prisma.$disconnect();
  });

  describe('Property 32: All-bookings endpoint supports filtering', () => {
    it('should filter bookings by userId', async () => {
      if (!isDatabaseAvailable) return;

      await fc.assert(
        fc.asyncProperty(
          // Generate random user index
          fc.integer({ min: 0, max: testUsers.length - 1 }),
          async (userIndex) => {
            const userId = testUsers[userIndex].id;

            // Query with userId filter
            const response = await request(app)
              .get(`/api/bookings/all?userId=${userId}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .expect(200);

            // Property: All returned bookings should belong to the specified user
            expect(response.body).toHaveProperty('bookings');
            expect(Array.isArray(response.body.bookings)).toBe(true);

            response.body.bookings.forEach((booking: any) => {
              expect(booking.userId).toBe(userId);
            });

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should filter bookings by roomId', async () => {
      if (!isDatabaseAvailable) return;

      await fc.assert(
        fc.asyncProperty(
          // Generate random room index
          fc.integer({ min: 0, max: testRooms.length - 1 }),
          async (roomIndex) => {
            const roomId = testRooms[roomIndex].id;

            // Query with roomId filter
            const response = await request(app)
              .get(`/api/bookings/all?roomId=${roomId}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .expect(200);

            // Property: All returned bookings should be for the specified room
            expect(response.body).toHaveProperty('bookings');
            expect(Array.isArray(response.body.bookings)).toBe(true);

            response.body.bookings.forEach((booking: any) => {
              expect(booking.roomId).toBe(roomId);
            });

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should filter bookings by date range', async () => {
      if (!isDatabaseAvailable) return;

      await fc.assert(
        fc.asyncProperty(
          // Generate random date offsets
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 6, max: 10 }),
          async (startOffset, endOffset) => {
            const now = new Date();
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() + startOffset);
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() + endOffset);

            // Query with date range filter
            const response = await request(app)
              .get(`/api/bookings/all?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .expect(200);

            // Property: All returned bookings should fall within the date range
            expect(response.body).toHaveProperty('bookings');
            expect(Array.isArray(response.body.bookings)).toBe(true);

            response.body.bookings.forEach((booking: any) => {
              const bookingStart = new Date(booking.startAt);
              const bookingEnd = new Date(booking.endAt);

              // Booking should start on or after startDate
              expect(bookingStart.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              // Booking should end on or before endDate
              expect(bookingEnd.getTime()).toBeLessThanOrEqual(endDate.getTime());
            });

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should support pagination', async () => {
      if (!isDatabaseAvailable) return;

      await fc.assert(
        fc.asyncProperty(
          // Generate random page and limit
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 2, max: 5 }),
          async (page, limit) => {
            // Query with pagination
            const response = await request(app)
              .get(`/api/bookings/all?page=${page}&limit=${limit}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .expect(200);

            // Property: Response should respect pagination parameters
            expect(response.body).toHaveProperty('bookings');
            expect(response.body).toHaveProperty('page');
            expect(response.body).toHaveProperty('limit');
            expect(response.body).toHaveProperty('total');
            expect(response.body).toHaveProperty('totalPages');

            expect(response.body.page).toBe(page);
            expect(response.body.limit).toBe(limit);
            expect(Array.isArray(response.body.bookings)).toBe(true);
            expect(response.body.bookings.length).toBeLessThanOrEqual(limit);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should support combined filters', async () => {
      if (!isDatabaseAvailable) return;

      await fc.assert(
        fc.asyncProperty(
          // Generate random user and room indices
          fc.integer({ min: 0, max: testUsers.length - 1 }),
          fc.integer({ min: 0, max: testRooms.length - 1 }),
          async (userIndex, roomIndex) => {
            const userId = testUsers[userIndex].id;
            const roomId = testRooms[roomIndex].id;

            // Query with combined filters
            const response = await request(app)
              .get(`/api/bookings/all?userId=${userId}&roomId=${roomId}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .expect(200);

            // Property: All returned bookings should match ALL specified filters
            expect(response.body).toHaveProperty('bookings');
            expect(Array.isArray(response.body.bookings)).toBe(true);

            response.body.bookings.forEach((booking: any) => {
              expect(booking.userId).toBe(userId);
              expect(booking.roomId).toBe(roomId);
            });

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return all bookings when no filters are applied', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/bookings/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Property: Without filters, endpoint should return bookings (up to limit)
      expect(response.body).toHaveProperty('bookings');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.bookings)).toBe(true);
      expect(response.body.total).toBeGreaterThan(0);
    });
  });
});
