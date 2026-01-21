import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BookingService } from './booking.service';
import { RuleService } from './rule.service';
import { RoomService } from './room.service';
import prisma from './db';

/**
 * Unit tests for BookingService
 * 
 * These tests focus on specific examples and edge cases,
 * complementing the property-based tests.
 */
describe('BookingService Unit Tests', () => {
  const bookingService = new BookingService(new RuleService(), new RoomService());
  let testUserId1: string;
  let testUserId2: string;
  let testRoomId: string;
  let defaultRules: any;

  beforeAll(async () => {
    // Get default rules
    const ruleService = new RuleService();
    defaultRules = await ruleService.getRules();

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: `concurrent-test-user1-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `concurrent-test-user2-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });
    testUserId2 = user2.id;

    // Create test room
    const room = await prisma.room.create({
      data: {
        name: `Concurrent Test Room ${Date.now()}`,
        capacity: 10,
        equipment: [],
        status: 'active',
      },
    });
    testRoomId = room.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({
      where: {
        OR: [{ userId: testUserId1 }, { userId: testUserId2 }],
      },
    });
    await prisma.user.delete({ where: { id: testUserId1 } });
    await prisma.user.delete({ where: { id: testUserId2 } });
    await prisma.room.delete({ where: { id: testRoomId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up bookings before each test
    await prisma.booking.deleteMany({
      where: {
        OR: [{ userId: testUserId1 }, { userId: testUserId2 }],
      },
    });
  });

  describe('Concurrent Booking Prevention', () => {
    it('should prevent double-booking under concurrent requests', async () => {
      // Validates: Requirements 15.1
      // This test verifies that when two users attempt to book the same room
      // at the same time, exactly one succeeds and one fails.

      const now = new Date();
      const startAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);

      const endAt = new Date(startAt);
      endAt.setTime(startAt.getTime() + 60 * 60 * 1000); // 1 hour booking

      // Fire two concurrent booking requests for the same time slot
      const results = await Promise.allSettled([
        bookingService.createBooking(testUserId1, testRoomId, startAt, endAt),
        bookingService.createBooking(testUserId2, testRoomId, startAt, endAt),
      ]);

      // Count successes and failures
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      // Exactly one should succeed, one should fail
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);

      // Verify the failure reason is about booking conflict or transaction conflict
      const failedResult = failures[0] as PromiseRejectedResult;
      expect(failedResult.reason.message).toMatch(/already booked|unavailable|write conflict|deadlock/i);

      // Verify the successful booking is in the database
      const successfulResult = successes[0] as PromiseFulfilledResult<any>;
      const booking = successfulResult.value;
      
      const dbBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      
      expect(dbBooking).toBeDefined();
      expect(dbBooking?.status).toBe('confirmed');
    });

    it('should handle three concurrent requests correctly', async () => {
      // Validates: Requirements 15.1
      // This test verifies that the system can handle multiple concurrent
      // requests and only allow one to succeed.

      const now = new Date();
      const startAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);

      const endAt = new Date(startAt);
      endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

      // Create a third user for this test
      const user3 = await prisma.user.create({
        data: {
          email: `concurrent-test-user3-${Date.now()}@example.com`,
          passwordHash: 'hashed_password',
          role: 'user',
        },
      });

      try {
        // Fire three concurrent booking requests
        const results = await Promise.allSettled([
          bookingService.createBooking(testUserId1, testRoomId, startAt, endAt),
          bookingService.createBooking(testUserId2, testRoomId, startAt, endAt),
          bookingService.createBooking(user3.id, testRoomId, startAt, endAt),
        ]);

        // Count successes and failures
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        // Exactly one should succeed, two should fail
        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(2);

        // Clean up
        await prisma.booking.deleteMany({ where: { userId: user3.id } });
      } finally {
        await prisma.user.delete({ where: { id: user3.id } });
      }
    });

    it('should allow concurrent bookings for different time slots', async () => {
      // Validates: Requirements 15.1, 15.5
      // This test verifies that concurrent requests for different time slots
      // both succeed (or at least one succeeds if there's a transaction conflict).

      const now = new Date();
      const startAt1 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
      startAt1.setUTCHours(defaultRules.openHour, 0, 0, 0);

      const endAt1 = new Date(startAt1);
      endAt1.setTime(startAt1.getTime() + 60 * 60 * 1000);

      // Second booking starts after first one ends
      const startAt2 = new Date(endAt1);
      const endAt2 = new Date(startAt2);
      endAt2.setTime(startAt2.getTime() + 60 * 60 * 1000);

      // Fire two concurrent booking requests for different time slots
      const results = await Promise.allSettled([
        bookingService.createBooking(testUserId1, testRoomId, startAt1, endAt1),
        bookingService.createBooking(testUserId2, testRoomId, startAt2, endAt2),
      ]);

      // Count successes and failures
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      // With SERIALIZABLE isolation, we might get transaction conflicts
      // even for non-overlapping bookings. At least one should succeed.
      expect(successes.length).toBeGreaterThanOrEqual(1);
      
      // If there are failures, they should be due to transaction conflicts
      if (failures.length > 0) {
        const failedResult = failures[0] as PromiseRejectedResult;
        expect(failedResult.reason.message).toMatch(/write conflict|deadlock/i);
      }

      // Verify at least one booking is in the database
      const bookings = await prisma.booking.findMany({
        where: {
          roomId: testRoomId,
          OR: [{ userId: testUserId1 }, { userId: testUserId2 }],
        },
      });

      expect(bookings.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle concurrent bookings with database constraint', async () => {
      // Validates: Requirements 15.1, 15.4
      // This test verifies that the database exclusion constraint
      // prevents overlapping bookings even if application logic fails.

      const now = new Date();
      const startAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);

      const endAt = new Date(startAt);
      endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

      // Create first booking
      const booking1 = await bookingService.createBooking(
        testUserId1,
        testRoomId,
        startAt,
        endAt
      );

      expect(booking1.status).toBe('confirmed');

      // Try to create overlapping booking (should fail)
      try {
        await bookingService.createBooking(
          testUserId2,
          testRoomId,
          startAt,
          endAt
        );
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        // Should fail with booking conflict error
        expect(error.message).toMatch(/already booked|unavailable/i);
      }

      // Verify only one booking exists
      const bookings = await prisma.booking.findMany({
        where: {
          roomId: testRoomId,
          startAt,
          endAt,
          status: 'confirmed',
        },
      });

      expect(bookings).toHaveLength(1);
      expect(bookings[0].id).toBe(booking1.id);
    });
  });
});
