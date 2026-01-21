import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import prisma from '../db';
import { registerUser } from '../auth';

describe('Rule Configuration API Endpoints', () => {
  let isDatabaseAvailable = false;
  let adminToken: string;
  let userToken: string;
  let originalRules: any;

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      isDatabaseAvailable = true;

      // Create admin user
      const admin = await registerUser(`admin-rules-${Date.now()}@example.com`, 'password123', 'admin');
      adminToken = admin.token;

      // Create regular user
      const user = await registerUser(`user-rules-${Date.now()}@example.com`, 'password123', 'user');
      userToken = user.token;

      // Store original rules to restore later
      originalRules = await prisma.ruleConfig.findUnique({
        where: { id: 1 },
      });
    } catch (error) {
      console.warn('Database not available, skipping integration tests');
      isDatabaseAvailable = false;
    }
  });

  describe('GET /api/rules', () => {
    it('should get current rules without authentication', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/rules')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('openHour');
      expect(response.body).toHaveProperty('closeHour');
      expect(response.body).toHaveProperty('timeSlotIntervalMinutes');
      expect(response.body).toHaveProperty('minDurationMinutes');
      expect(response.body).toHaveProperty('maxDurationMinutes');
      expect(response.body).toHaveProperty('maxActiveBookings');
      expect(response.body).toHaveProperty('minNoticeMinutes');
      expect(response.body).toHaveProperty('maxDaysAhead');
    });

    it('should return rule configuration with correct structure', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .get('/api/rules')
        .expect(200);

      // Verify data types
      expect(typeof response.body.openHour).toBe('number');
      expect(typeof response.body.closeHour).toBe('number');
      expect(typeof response.body.timeSlotIntervalMinutes).toBe('number');
      expect(typeof response.body.minDurationMinutes).toBe('number');
      expect(typeof response.body.maxDurationMinutes).toBe('number');
      expect(typeof response.body.maxActiveBookings).toBe('number');
      expect(typeof response.body.minNoticeMinutes).toBe('number');
      expect(typeof response.body.maxDaysAhead).toBe('number');

      // Verify reasonable values
      expect(response.body.openHour).toBeGreaterThanOrEqual(0);
      expect(response.body.openHour).toBeLessThan(24);
      expect(response.body.closeHour).toBeGreaterThan(0);
      expect(response.body.closeHour).toBeLessThanOrEqual(24);
      expect(response.body.openHour).toBeLessThan(response.body.closeHour);
    });
  });

  describe('PUT /api/rules', () => {
    it('should allow admin to update rules', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxActiveBookings: 5,
          minNoticeMinutes: 60,
        })
        .expect(200);

      expect(response.body.maxActiveBookings).toBe(5);
      expect(response.body.minNoticeMinutes).toBe(60);

      // Restore original values
      await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxActiveBookings: originalRules.maxActiveBookings,
          minNoticeMinutes: originalRules.minNoticeMinutes,
        });
    });

    it('should reject rule update by non-admin user', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          maxActiveBookings: 10,
        })
        .expect(403);

      expect(response.body.error.code).toBe('ADMIN_REQUIRED');
    });

    it('should reject rule update without authentication', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .send({
          maxActiveBookings: 10,
        })
        .expect(401);

      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should reject empty update request', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(response.body.error.message).toContain('At least one rule field must be provided');
    });

    it('should reject invalid openHour value', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          openHour: -1,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_OPEN_HOUR');
      expect(response.body.error.message).toContain('openHour must be between 0 and 23');
    });

    it('should reject invalid closeHour value', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          closeHour: 25,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_CLOSE_HOUR');
      expect(response.body.error.message).toContain('closeHour must be between 0 and 24');
    });

    it('should reject openHour >= closeHour', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          openHour: 18,
          closeHour: 18,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_HOURS');
      expect(response.body.error.message).toContain('openHour must be less than closeHour');
    });

    it('should reject negative timeSlotIntervalMinutes', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          timeSlotIntervalMinutes: 0,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_TIME_SLOT_INTERVAL');
    });

    it('should reject negative minDurationMinutes', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          minDurationMinutes: 0,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_MIN_DURATION');
    });

    it('should reject negative maxDurationMinutes', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxDurationMinutes: -10,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_MAX_DURATION');
    });

    it('should reject minDurationMinutes > maxDurationMinutes', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          minDurationMinutes: 120,
          maxDurationMinutes: 60,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_DURATION_RANGE');
      expect(response.body.error.message).toContain('minDurationMinutes must be less than or equal to maxDurationMinutes');
    });

    it('should reject negative maxActiveBookings', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxActiveBookings: 0,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_MAX_ACTIVE_BOOKINGS');
    });

    it('should reject negative maxConsecutive', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxConsecutive: -1,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_MAX_CONSECUTIVE');
    });

    it('should accept null maxConsecutive', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxConsecutive: null,
        })
        .expect(200);

      expect(response.body.maxConsecutive).toBeNull();

      // Restore original value
      await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxConsecutive: originalRules.maxConsecutive,
        });
    });

    it('should reject negative cooldownMinutes', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cooldownMinutes: -5,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_COOLDOWN');
    });

    it('should accept null cooldownMinutes', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cooldownMinutes: null,
        })
        .expect(200);

      expect(response.body.cooldownMinutes).toBeNull();

      // Restore original value
      await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cooldownMinutes: originalRules.cooldownMinutes,
        });
    });

    it('should reject negative minNoticeMinutes', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          minNoticeMinutes: -10,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_MIN_NOTICE');
    });

    it('should reject zero or negative maxDaysAhead', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxDaysAhead: 0,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_MAX_DAYS_AHEAD');
    });

    it('should update multiple rule fields at once', async () => {
      if (!isDatabaseAvailable) return;

      const response = await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxActiveBookings: 4,
          minNoticeMinutes: 45,
          maxDaysAhead: 21,
        })
        .expect(200);

      expect(response.body.maxActiveBookings).toBe(4);
      expect(response.body.minNoticeMinutes).toBe(45);
      expect(response.body.maxDaysAhead).toBe(21);

      // Restore original values
      await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxActiveBookings: originalRules.maxActiveBookings,
          minNoticeMinutes: originalRules.minNoticeMinutes,
          maxDaysAhead: originalRules.maxDaysAhead,
        });
    });
  });

  describe('Audit logging for rule updates', () => {
    it('should create audit log entry when rules are updated', async () => {
      if (!isDatabaseAvailable) return;

      // Update a rule
      await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxActiveBookings: 6,
        })
        .expect(200);

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'rules_updated',
          entityType: 'rule_config',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const latestLog = auditLogs[0];
      expect(latestLog.action).toBe('rules_updated');
      expect(latestLog.entityType).toBe('rule_config');
      expect(latestLog.actorId).toBeDefined();
      expect(latestLog.payload).toBeDefined();

      // Restore original value
      await request(app)
        .put('/api/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxActiveBookings: originalRules.maxActiveBookings,
        });
    });
  });
});
