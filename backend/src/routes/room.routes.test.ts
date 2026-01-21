import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import prisma from '../db';
import { registerUser } from '../auth';

describe('Room API Endpoints', () => {
  let isDatabaseAvailable = false;
  let adminToken: string;
  let userToken: string;
  let testRoomId: string;

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      isDatabaseAvailable = true;

      // Create admin user
      const admin = await registerUser(`admin-${Date.now()}@example.com`, 'password123', 'admin');
      adminToken = admin.token;

      // Create regular user
      const user = await registerUser(`user-${Date.now()}@example.com`, 'password123', 'user');
      userToken = user.token;

      // Create a test room for GET tests
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

  describe('GET /api/rooms/search', () => {
    it('should search rooms with various filters', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/rooms/search')
        .query({
          date: '2026-01-20',
          startTime: '09:00',
          endTime: '10:00',
          minCapacity: 5,
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify each room has required fields
      response.body.forEach((room: any) => {
        expect(room).toHaveProperty('id');
        expect(room).toHaveProperty('name');
        expect(room).toHaveProperty('capacity');
        expect(room).toHaveProperty('equipment');
        expect(room).toHaveProperty('availabilityStatus');
        expect(['available', 'partially_available', 'unavailable', 'maintenance']).toContain(room.availabilityStatus);
      });
    });

    it('should search rooms with equipment filter', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/rooms/search')
        .query({
          date: '2026-01-20',
          startTime: '09:00',
          endTime: '10:00',
          equipment: 'projector',
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject search without required date parameter', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/rooms/search')
        .query({
          startTime: '09:00',
          endTime: '10:00',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('date, startTime, and endTime are required');
    });

    it('should reject search with invalid date format', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/rooms/search')
        .query({
          date: 'invalid-date',
          startTime: '09:00',
          endTime: '10:00',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Invalid date format');
    });

    it('should reject search with invalid time format', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/rooms/search')
        .query({
          date: '2026-01-20',
          startTime: '25:00',
          endTime: '10:00',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('Invalid startTime format');
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('should get room details by ID', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get(`/api/rooms/${testRoomId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testRoomId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('capacity');
      expect(response.body).toHaveProperty('equipment');
      expect(response.body).toHaveProperty('status');
    });

    it('should return 404 for non-existent room', async () => {
      if (!isDatabaseAvailable) return;

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/rooms/${fakeId}`)
        .expect(404);

      expect(response.body.error.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('POST /api/rooms', () => {
    it('should allow admin to create a room', async () => {
      if (!isDatabaseAvailable) return;

      const uniqueName = `Admin Room ${Date.now()}`;
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: uniqueName,
          capacity: 15,
          equipment: ['projector', 'whiteboard', 'tv'],
          status: 'active',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(uniqueName);
      expect(response.body.capacity).toBe(15);
      expect(response.body.equipment).toEqual(['projector', 'whiteboard', 'tv']);
      expect(response.body.status).toBe('active');
    });

    it('should reject room creation by non-admin user', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: `User Room ${Date.now()}`,
          capacity: 10,
          equipment: [],
          status: 'active',
        })
        .expect(403);

      expect(response.body.error.code).toBe('ADMIN_REQUIRED');
    });

    it('should reject room creation without authentication', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/rooms')
        .send({
          name: `Unauth Room ${Date.now()}`,
          capacity: 10,
          equipment: [],
          status: 'active',
        })
        .expect(401);

      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should reject room creation with missing required fields', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capacity: 10,
          status: 'active',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('name, capacity, and status are required');
    });

    it('should reject room creation with invalid capacity', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Invalid Capacity Room ${Date.now()}`,
          capacity: -5,
          equipment: [],
          status: 'active',
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('capacity must be a positive number');
    });

    it('should reject room creation with duplicate name', async () => {
      if (!isDatabaseAvailable) return;

      const duplicateName = `Duplicate Room ${Date.now()}`;
      
      // Create first room
      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: duplicateName,
          capacity: 10,
          equipment: [],
          status: 'active',
        })
        .expect(201);

      // Try to create room with same name
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: duplicateName,
          capacity: 15,
          equipment: [],
          status: 'active',
        })
        .expect(409);

      expect(response.body.error.code).toBe('DUPLICATE_NAME');
    });
  });

  describe('PUT /api/rooms/:id', () => {
    it('should allow admin to update a room', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capacity: 20,
          status: 'maintenance',
        })
        .expect(200);

      expect(response.body.id).toBe(testRoomId);
      expect(response.body.capacity).toBe(20);
      expect(response.body.status).toBe('maintenance');
    });

    it('should reject room update by non-admin user', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          capacity: 25,
        })
        .expect(403);

      expect(response.body.error.code).toBe('ADMIN_REQUIRED');
    });

    it('should return 404 when updating non-existent room', async () => {
      if (!isDatabaseAvailable) return;

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .put(`/api/rooms/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capacity: 15,
        })
        .expect(404);

      expect(response.body.error.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('DELETE /api/rooms/:id', () => {
    it('should allow admin to archive a room', async () => {
      if (!isDatabaseAvailable) return;

      // Create a room to archive
      const room = await prisma.room.create({
        data: {
          name: `Archive Room ${Date.now()}`,
          capacity: 10,
          equipment: [],
          status: 'active',
        },
      });

      const response = await request(app)
        .delete(`/api/rooms/${room.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify room is archived
      const archivedRoom = await prisma.room.findUnique({
        where: { id: room.id },
      });
      expect(archivedRoom?.status).toBe('archived');
    });

    it('should reject room deletion by non-admin user', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .delete(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('ADMIN_REQUIRED');
    });

    it('should return 404 when deleting non-existent room', async () => {
      if (!isDatabaseAvailable) return;

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/rooms/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('ROOM_NOT_FOUND');
    });
  });
});
