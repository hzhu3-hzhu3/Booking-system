import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import prisma from '../db';
import { registerUser } from '../auth';

describe('Booking API Endpoints', () => {
  let isDatabaseAvailable = false;
  let testUserToken: string;
  let testUserId: string;
  let adminToken: string;
  let adminId: string;
  let testRoomId: string;

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      isDatabaseAvailable = true;

      // Create test user
      const userResult = await registerUser(
        `booking-test-user-${Date.now()}@example.com`,
        'password123'
      );
      testUserToken = userResult.token;
      testUserId = userResult.user.id;

      // Create admin user
      const adminResult = await registerUser(
        `booking-test-admin-${Date.now()}@example.com`,
        'password123',
        'admin'
      );
      adminToken = adminResult.token;
      adminId = adminResult.user.id;

      // Create test room
      const room = await prisma.room.create({
        data: {
          name: `Test Room ${Date.now()}`,
          capacity: 10,
          equipment: ['projector', 'whiteboard'],
          status: 'active',
        },
      });
      testRoomId = room.id;
    } catch (error) {
      console.warn('Database not available, skipping integration tests');
      isDatabaseAvailable = false;
    }
  });

  describe('POST /api/bookings', () => {
    beforeEach(async () => {
      if (!isDatabaseAvailable) return;
      // Clean up bookings before each test to avoid conflicts
      await prisma.booking.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('should create a booking with valid inputs', async () => {
      if (!isDatabaseAvailable) return;

      // Create booking tomorrow at 10:00 AM for 1 hour (within operating hours 8:00-22:00)
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const startAt = tomorrow;
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          roomId: testRoomId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.userId).toBe(testUserId);
      expect(response.body.roomId).toBe(testRoomId);
      expect(response.body.status).toBe('confirmed');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room).toHaveProperty('name');
    });

    it('should reject booking without authentication', async () => {
      if (!isDatabaseAvailable) return;

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const startAt = tomorrow;
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      const response = await request(app)
        .post('/api/bookings')
        .send({
          roomId: testRoomId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        })
        .expect(401);

      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should reject booking with missing fields', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          roomId: testRoomId,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('required');
    });

    it('should reject booking with invalid time range', async () => {
      if (!isDatabaseAvailable) return;

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const startAt = tomorrow;
      const endAt = new Date(startAt.getTime() - 60 * 60 * 1000); // End before start

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          roomId: testRoomId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_TIME_RANGE');
    });

    it('should reject booking with conflicts', async () => {
      if (!isDatabaseAvailable) return;

      // Create a second user to avoid cooldown/max bookings issues
      const user2Result = await registerUser(
        `conflict-test-user-${Date.now()}@example.com`,
        'password123'
      );
      const user2Token = user2Result.token;

      // Create first booking
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 2);
      tomorrow.setHours(13, 0, 0, 0);
      const startAt = tomorrow;
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          roomId: testRoomId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        })
        .expect(201);

      // Try to create overlapping booking with different user
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          roomId: testRoomId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        })
        .expect(409);

      expect(response.body.error.code).toBe('BOOKING_CONFLICT');
    });
  });

  describe('GET /api/bookings/my', () => {
    beforeEach(async () => {
      if (!isDatabaseAvailable) return;

      // Clean up previous bookings for this user
      await prisma.booking.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('should return user bookings', async () => {
      if (!isDatabaseAvailable) return;

      // Create a booking
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0); // 2:00 PM tomorrow
      const startAt = tomorrow;
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          roomId: testRoomId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });

      // Get user bookings
      const response = await request(app)
        .get('/api/bookings/my')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('room');
      expect(response.body[0].userId).toBe(testUserId);
    });

    it('should require authentication', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/bookings/my')
        .expect(401);

      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    let bookingId: string;

    beforeEach(async () => {
      if (!isDatabaseAvailable) return;

      // Create a booking to cancel
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(16, 0, 0, 0); // 4:00 PM tomorrow
      const startAt = tomorrow;
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      const booking = await prisma.booking.create({
        data: {
          userId: testUserId,
          roomId: testRoomId,
          startAt,
          endAt,
          status: 'confirmed',
        },
      });
      bookingId = booking.id;
    });

    it('should allow user to cancel own booking', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.booking.status).toBe('cancelled');
      expect(response.body.booking.cancelledBy).toBe(testUserId);
    });

    it('should require authentication', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .expect(401);

      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should reject cancellation of non-existent booking', async () => {
      if (!isDatabaseAvailable) return;

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/bookings/${fakeId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('BOOKING_NOT_FOUND');
    });
  });

  describe('GET /api/bookings/all', () => {
    beforeEach(async () => {
      if (!isDatabaseAvailable) return;

      // Clean up previous bookings
      await prisma.booking.deleteMany({});

      // Create some test bookings
      const now = new Date();
      for (let i = 0; i < 3; i++) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1 + i);
        tomorrow.setHours(10 + i, 0, 0, 0); // 10:00, 11:00, 12:00
        const startAt = tomorrow;
        const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

        await prisma.booking.create({
          data: {
            userId: testUserId,
            roomId: testRoomId,
            startAt,
            endAt,
            status: 'confirmed',
          },
        });
      }
    });

    it('should allow admin to view all bookings', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/bookings/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('bookings');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(Array.isArray(response.body.bookings)).toBe(true);
      expect(response.body.bookings.length).toBeGreaterThan(0);
    });

    it('should support filtering by userId', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get(`/api/bookings/all?userId=${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.bookings.length).toBeGreaterThan(0);
      response.body.bookings.forEach((booking: any) => {
        expect(booking.userId).toBe(testUserId);
      });
    });

    it('should support filtering by roomId', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get(`/api/bookings/all?roomId=${testRoomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.bookings.length).toBeGreaterThan(0);
      response.body.bookings.forEach((booking: any) => {
        expect(booking.roomId).toBe(testRoomId);
      });
    });

    it('should support pagination', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/bookings/all?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.bookings.length).toBeLessThanOrEqual(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body).toHaveProperty('totalPages');
    });

    it('should reject non-admin access', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/bookings/all')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('ADMIN_REQUIRED');
    });

    it('should require authentication', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/bookings/all')
        .expect(401);

      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });
  });
});
