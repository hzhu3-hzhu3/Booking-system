import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AuditLogService } from './audit.service';
import { BookingService } from './booking.service';
import { RuleService } from './rule.service';
import { RoomService } from './room.service';
import prisma from './db';

// Feature: breakout-room-booking
// Property 33: Booking operations are logged
// Property 34: Admin operations are logged
// Property 35: Audit logs have required structure
// Validates: Requirements 16.1, 16.2, 16.3

describe('AuditLogService Property Tests', () => {
  const auditLogService = new AuditLogService();
  const bookingService = new BookingService(new RuleService(), new RoomService());
  const roomService = new RoomService();
  const ruleService = new RuleService();

  let testUser: any;
  let testAdmin: any;

  beforeAll(async () => {
    // Create test users
    testUser = await prisma.user.create({
      data: {
        email: `test-user-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });

    testAdmin = await prisma.user.create({
      data: {
        email: `test-admin-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'admin',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        id: { in: [testUser.id, testAdmin.id] },
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up audit logs before each test
    await prisma.auditLog.deleteMany({});
  });

  describe('Property 33: Booking operations are logged', () => {
    it('should log booking creation with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 20 }),
          async (roomName, capacity) => {
            // Create a room for booking
            const room = await prisma.room.create({
              data: {
                name: `${roomName}-${Date.now()}-${Math.random()}`,
                capacity,
                equipment: [],
                status: 'active',
              },
            });

            // Create a booking with valid time within operating hours (8:00-22:00)
            const now = new Date();
            // Set to tomorrow at 10:00 AM to ensure it's more than 30 minutes in advance
            const startAt = new Date(now);
            startAt.setDate(startAt.getDate() + 1); // Tomorrow
            startAt.setUTCHours(10, 0, 0, 0); // 10:00 AM
            const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // 1 hour duration (11:00 AM)

            try {
              const booking = await bookingService.createBooking(
                testUser.id,
                room.id,
                startAt,
                endAt
              );

              // Log the booking creation
              const auditLog = await auditLogService.logBookingCreated(
                testUser.id,
                booking.id,
                {
                  roomId: room.id,
                  roomName: room.name,
                  startAt: startAt.toISOString(),
                  endAt: endAt.toISOString(),
                }
              );

              // Property: Booking creation should be logged with required fields
              expect(auditLog).toBeDefined();
              expect(auditLog.actorId).toBe(testUser.id);
              expect(auditLog.action).toBe('booking_created');
              expect(auditLog.entityType).toBe('booking');
              expect(auditLog.entityId).toBe(booking.id);
              expect(auditLog.payload).toBeDefined();
              expect(auditLog.createdAt).toBeInstanceOf(Date);

              // Cleanup
              await prisma.booking.delete({ where: { id: booking.id } });
            } finally {
              await prisma.room.delete({ where: { id: room.id } });
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should log booking cancellation with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 20 }),
          async (roomName, capacity) => {
            // Create a room and booking
            const room = await prisma.room.create({
              data: {
                name: `${roomName}-${Date.now()}-${Math.random()}`,
                capacity,
                equipment: [],
                status: 'active',
              },
            });

            // Create booking with valid time within operating hours (8:00-22:00)
            const now = new Date();
            // Set to tomorrow at 10:00 AM to ensure it's more than 30 minutes in advance
            const startAt = new Date(now);
            startAt.setDate(startAt.getDate() + 1); // Tomorrow
            // Set to a valid hour between 8 and 21
            startAt.setUTCHours(10, 0, 0, 0); // 10:00 AM
            const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // 11:00 AM

            try {
              const booking = await bookingService.createBooking(
                testUser.id,
                room.id,
                startAt,
                endAt
              );

              // Cancel the booking
              const cancelledBooking = await bookingService.cancelBooking(
                booking.id,
                testUser.id,
                false
              );

              // Log the cancellation
              const auditLog = await auditLogService.logBookingCancelled(
                testUser.id,
                booking.id,
                {
                  roomId: room.id,
                  roomName: room.name,
                  cancelledAt: cancelledBooking.cancelledAt?.toISOString(),
                }
              );

              // Property: Booking cancellation should be logged with required fields
              expect(auditLog).toBeDefined();
              expect(auditLog.actorId).toBe(testUser.id);
              expect(auditLog.action).toBe('booking_cancelled');
              expect(auditLog.entityType).toBe('booking');
              expect(auditLog.entityId).toBe(booking.id);
              expect(auditLog.payload).toBeDefined();
              expect(auditLog.createdAt).toBeInstanceOf(Date);

              // Cleanup
              await prisma.booking.delete({ where: { id: booking.id } });
            } finally {
              await prisma.room.delete({ where: { id: room.id } });
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should log booking expiration with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (bookingId) => {
            // Log booking expiration
            const auditLog = await auditLogService.logBookingExpired(
              `booking-${bookingId}`,
              {
                expiredAt: new Date().toISOString(),
              }
            );

            // Property: Booking expiration should be logged with required fields
            expect(auditLog).toBeDefined();
            expect(auditLog.actorId).toBeNull(); // System action, no actor
            expect(auditLog.action).toBe('booking_expired');
            expect(auditLog.entityType).toBe('booking');
            expect(auditLog.entityId).toBe(`booking-${bookingId}`);
            expect(auditLog.payload).toBeDefined();
            expect(auditLog.createdAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 34: Admin operations are logged', () => {
    it('should log room creation with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 20 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
          async (roomName, capacity, equipment) => {
            // Create a room
            const room = await roomService.createRoom({
              name: `${roomName}-${Date.now()}-${Math.random()}`,
              capacity,
              equipment,
              status: 'active',
            });

            try {
              // Log room creation
              const auditLog = await auditLogService.logRoomCreated(
                testAdmin.id,
                room.id,
                {
                  name: room.name,
                  capacity: room.capacity,
                  equipment: room.equipment,
                  status: room.status,
                }
              );

              // Property: Room creation should be logged with required fields
              expect(auditLog).toBeDefined();
              expect(auditLog.actorId).toBe(testAdmin.id);
              expect(auditLog.action).toBe('room_created');
              expect(auditLog.entityType).toBe('room');
              expect(auditLog.entityId).toBe(room.id);
              expect(auditLog.payload).toBeDefined();
              expect(auditLog.createdAt).toBeInstanceOf(Date);
            } finally {
              await prisma.room.delete({ where: { id: room.id } });
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should log room updates with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 30 }),
          async (roomName, oldCapacity, newCapacity) => {
            // Create a room
            const room = await roomService.createRoom({
              name: `${roomName}-${Date.now()}-${Math.random()}`,
              capacity: oldCapacity,
              equipment: [],
              status: 'active',
            });

            try {
              // Update the room
              const updatedRoom = await roomService.updateRoom(room.id, {
                capacity: newCapacity,
              });

              // Log room update
              const auditLog = await auditLogService.logRoomUpdated(
                testAdmin.id,
                room.id,
                {
                  before: { capacity: oldCapacity },
                  after: { capacity: newCapacity },
                }
              );

              // Property: Room update should be logged with required fields
              expect(auditLog).toBeDefined();
              expect(auditLog.actorId).toBe(testAdmin.id);
              expect(auditLog.action).toBe('room_updated');
              expect(auditLog.entityType).toBe('room');
              expect(auditLog.entityId).toBe(room.id);
              expect(auditLog.payload).toBeDefined();
              expect(auditLog.createdAt).toBeInstanceOf(Date);
            } finally {
              await prisma.room.delete({ where: { id: room.id } });
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should log rule configuration updates with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 2, max: 10 }),
          async (oldMaxActive, newMaxActive) => {
            // Get current rules
            const currentRules = await ruleService.getRules();

            // Update rules
            const updatedRules = await ruleService.updateRules({
              maxActiveBookings: newMaxActive,
            });

            try {
              // Log rule update
              const auditLog = await auditLogService.logRulesUpdated(
                testAdmin.id,
                {
                  before: { maxActiveBookings: currentRules.maxActiveBookings },
                  after: { maxActiveBookings: newMaxActive },
                }
              );

              // Property: Rule update should be logged with required fields
              expect(auditLog).toBeDefined();
              expect(auditLog.actorId).toBe(testAdmin.id);
              expect(auditLog.action).toBe('rules_updated');
              expect(auditLog.entityType).toBe('rule_config');
              expect(auditLog.payload).toBeDefined();
              expect(auditLog.createdAt).toBeInstanceOf(Date);
            } finally {
              // Restore original rules
              await ruleService.updateRules({
                maxActiveBookings: currentRules.maxActiveBookings,
              });
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 35: Audit logs have required structure', () => {
    it('should create audit logs with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('booking', 'room', 'rule_config', 'maintenance_block'),
          fc.constantFrom(
            'created',
            'updated',
            'deleted',
            'cancelled',
            'expired'
          ),
          fc.record({
            key1: fc.string(),
            key2: fc.integer(),
          }),
          async (entityId, entityType, actionSuffix, payload) => {
            const action = `${entityType}_${actionSuffix}`;

            // Create audit log
            const auditLog = await auditLogService.logAction({
              actorId: testUser.id,
              action,
              entityType,
              entityId,
              payload,
            });

            // Property: All audit logs must have required structure
            expect(auditLog).toBeDefined();
            expect(auditLog.id).toBeDefined();
            expect(typeof auditLog.id).toBe('string');
            expect(auditLog.actorId).toBe(testUser.id);
            expect(auditLog.action).toBe(action);
            expect(auditLog.entityType).toBe(entityType);
            expect(auditLog.entityId).toBe(entityId);
            expect(auditLog.payload).toBeDefined();
            expect(auditLog.createdAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should support audit logs without actor (system actions)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (entityId) => {
            // Create audit log without actor
            const auditLog = await auditLogService.logAction({
              action: 'system_action',
              entityType: 'booking',
              entityId,
              payload: { automated: true },
            });

            // Property: System actions should have null actorId
            expect(auditLog).toBeDefined();
            expect(auditLog.actorId).toBeNull();
            expect(auditLog.action).toBe('system_action');
            expect(auditLog.entityType).toBe('booking');
            expect(auditLog.entityId).toBe(entityId);
            expect(auditLog.createdAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should support filtering audit logs by various criteria', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              action: fc.constantFrom('booking_created', 'room_updated', 'rules_updated'),
              entityType: fc.constantFrom('booking', 'room', 'rule_config'),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (logEntries) => {
            // Create multiple audit logs
            const createdLogs = [];
            for (const entry of logEntries) {
              const log = await auditLogService.logAction({
                actorId: testUser.id,
                action: entry.action,
                entityType: entry.entityType,
                entityId: `entity-${Math.random()}`,
                payload: { test: true },
              });
              createdLogs.push(log);
            }

            // Test filtering by actorId
            const logsByActor = await auditLogService.getAuditLogs({
              actorId: testUser.id,
            });

            // Property: Filtering should return only matching logs
            expect(logsByActor.length).toBeGreaterThanOrEqual(createdLogs.length);
            logsByActor.forEach((log) => {
              expect(log.actorId).toBe(testUser.id);
            });

            // Test filtering by entityType
            const bookingLogs = logEntries.filter((e) => e.entityType === 'booking');
            if (bookingLogs.length > 0) {
              const logsByEntityType = await auditLogService.getAuditLogs({
                entityType: 'booking',
              });

              logsByEntityType.forEach((log) => {
                expect(log.entityType).toBe('booking');
              });
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
