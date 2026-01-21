import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AuditLogService } from './audit.service';
import prisma from './db';

describe('AuditLogService Unit Tests', () => {
  const auditLogService = new AuditLogService();
  let testUser: any;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: `audit-test-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({});
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up audit logs before each test
    await prisma.auditLog.deleteMany({});
  });

  describe('logAction', () => {
    it('should create an audit log with all fields', async () => {
      const auditLog = await auditLogService.logAction({
        actorId: testUser.id,
        action: 'test_action',
        entityType: 'test_entity',
        entityId: 'entity-123',
        payload: { key: 'value' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.actorId).toBe(testUser.id);
      expect(auditLog.action).toBe('test_action');
      expect(auditLog.entityType).toBe('test_entity');
      expect(auditLog.entityId).toBe('entity-123');
      expect(auditLog.payload).toEqual({ key: 'value' });
      expect(auditLog.createdAt).toBeInstanceOf(Date);
    });

    it('should create an audit log without actorId for system actions', async () => {
      const auditLog = await auditLogService.logAction({
        action: 'system_action',
        entityType: 'booking',
        entityId: 'booking-123',
        payload: { automated: true },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.actorId).toBeNull();
      expect(auditLog.action).toBe('system_action');
    });

    it('should create an audit log without entityId', async () => {
      const auditLog = await auditLogService.logAction({
        actorId: testUser.id,
        action: 'bulk_action',
        entityType: 'booking',
        payload: { count: 5 },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.entityId).toBeNull();
    });

    it('should create an audit log without payload', async () => {
      const auditLog = await auditLogService.logAction({
        actorId: testUser.id,
        action: 'simple_action',
        entityType: 'room',
        entityId: 'room-123',
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.payload).toBeNull();
    });
  });

  describe('getAuditLogs', () => {
    beforeEach(async () => {
      // Create test audit logs
      await auditLogService.logAction({
        actorId: testUser.id,
        action: 'booking_created',
        entityType: 'booking',
        entityId: 'booking-1',
        payload: { roomId: 'room-1' },
      });

      await auditLogService.logAction({
        actorId: testUser.id,
        action: 'booking_cancelled',
        entityType: 'booking',
        entityId: 'booking-1',
        payload: { reason: 'user request' },
      });

      await auditLogService.logAction({
        actorId: testUser.id,
        action: 'room_created',
        entityType: 'room',
        entityId: 'room-1',
        payload: { name: 'Test Room' },
      });
    });

    it('should return all audit logs when no filters provided', async () => {
      const logs = await auditLogService.getAuditLogs();

      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by actorId', async () => {
      const logs = await auditLogService.getAuditLogs({
        actorId: testUser.id,
      });

      expect(logs.length).toBeGreaterThanOrEqual(3);
      logs.forEach((log) => {
        expect(log.actorId).toBe(testUser.id);
      });
    });

    it('should filter by entityType', async () => {
      const logs = await auditLogService.getAuditLogs({
        entityType: 'booking',
      });

      expect(logs.length).toBeGreaterThanOrEqual(2);
      logs.forEach((log) => {
        expect(log.entityType).toBe('booking');
      });
    });

    it('should filter by entityId', async () => {
      const logs = await auditLogService.getAuditLogs({
        entityId: 'booking-1',
      });

      expect(logs.length).toBeGreaterThanOrEqual(2);
      logs.forEach((log) => {
        expect(log.entityId).toBe('booking-1');
      });
    });

    it('should filter by action', async () => {
      const logs = await auditLogService.getAuditLogs({
        action: 'booking_created',
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
      logs.forEach((log) => {
        expect(log.action).toBe('booking_created');
      });
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const logs = await auditLogService.getAuditLogs({
        startDate: oneHourAgo,
        endDate: oneHourFromNow,
      });

      expect(logs.length).toBeGreaterThanOrEqual(3);
      logs.forEach((log) => {
        expect(log.createdAt.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        expect(log.createdAt.getTime()).toBeLessThanOrEqual(oneHourFromNow.getTime());
      });
    });

    it('should support pagination with limit and offset', async () => {
      const firstPage = await auditLogService.getAuditLogs({
        limit: 2,
        offset: 0,
      });

      const secondPage = await auditLogService.getAuditLogs({
        limit: 2,
        offset: 2,
      });

      expect(firstPage.length).toBeLessThanOrEqual(2);
      expect(secondPage.length).toBeLessThanOrEqual(2);

      // Ensure different results (if enough logs exist)
      if (firstPage.length > 0 && secondPage.length > 0) {
        expect(firstPage[0].id).not.toBe(secondPage[0].id);
      }
    });

    it('should return logs in descending order by createdAt', async () => {
      const logs = await auditLogService.getAuditLogs();

      for (let i = 1; i < logs.length; i++) {
        expect(logs[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          logs[i].createdAt.getTime()
        );
      }
    });
  });

  describe('Helper methods', () => {
    it('should log booking created', async () => {
      const log = await auditLogService.logBookingCreated(
        testUser.id,
        'booking-123',
        { roomId: 'room-1' }
      );

      expect(log.action).toBe('booking_created');
      expect(log.entityType).toBe('booking');
      expect(log.entityId).toBe('booking-123');
    });

    it('should log booking cancelled', async () => {
      const log = await auditLogService.logBookingCancelled(
        testUser.id,
        'booking-123',
        { reason: 'user request' }
      );

      expect(log.action).toBe('booking_cancelled');
      expect(log.entityType).toBe('booking');
    });

    it('should log booking expired', async () => {
      const log = await auditLogService.logBookingExpired('booking-123', {
        expiredAt: new Date().toISOString(),
      });

      expect(log.action).toBe('booking_expired');
      expect(log.entityType).toBe('booking');
      expect(log.actorId).toBeNull();
    });

    it('should log room created', async () => {
      const log = await auditLogService.logRoomCreated(testUser.id, 'room-123', {
        name: 'Test Room',
      });

      expect(log.action).toBe('room_created');
      expect(log.entityType).toBe('room');
    });

    it('should log room updated', async () => {
      const log = await auditLogService.logRoomUpdated(testUser.id, 'room-123', {
        before: { capacity: 10 },
        after: { capacity: 15 },
      });

      expect(log.action).toBe('room_updated');
      expect(log.entityType).toBe('room');
    });

    it('should log room archived', async () => {
      const log = await auditLogService.logRoomArchived(testUser.id, 'room-123', {
        status: 'archived',
      });

      expect(log.action).toBe('room_archived');
      expect(log.entityType).toBe('room');
    });

    it('should log rules updated', async () => {
      const log = await auditLogService.logRulesUpdated(testUser.id, {
        before: { maxActiveBookings: 3 },
        after: { maxActiveBookings: 5 },
      });

      expect(log.action).toBe('rules_updated');
      expect(log.entityType).toBe('rule_config');
    });

    it('should log maintenance block created', async () => {
      const log = await auditLogService.logMaintenanceBlockCreated(
        testUser.id,
        'block-123',
        { roomId: 'room-1' }
      );

      expect(log.action).toBe('maintenance_block_created');
      expect(log.entityType).toBe('maintenance_block');
    });

    it('should log maintenance block deleted', async () => {
      const log = await auditLogService.logMaintenanceBlockDeleted(
        testUser.id,
        'block-123',
        { roomId: 'room-1' }
      );

      expect(log.action).toBe('maintenance_block_deleted');
      expect(log.entityType).toBe('maintenance_block');
    });
  });
});
