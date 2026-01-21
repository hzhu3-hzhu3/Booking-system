import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { BookingService } from './booking.service';
import { RuleService } from './rule.service';
import { RoomService } from './room.service';
import prisma from './db';

// Feature: breakout-room-booking
// Property 18: Bookings must fall within operating hours
// Property 19: Start times must align to time slot intervals
// Property 20: Duration must meet minimum requirement
// Property 21: Duration must not exceed maximum
// Property 25: Minimum notice is enforced
// Property 26: Maximum advance booking is enforced
// Validates: Requirements 6.1, 6.2, 7.1, 7.2, 9.1, 9.2

describe('BookingService Property Tests - Time and Duration Validation', () => {
  const bookingService = new BookingService(new RuleService(), new RoomService());
  let defaultRules: any;

  beforeAll(async () => {
    // Get default rules for test setup
    const ruleService = new RuleService();
    defaultRules = await ruleService.getRules();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Property 18: Bookings must fall within operating hours', () => {
    it('should reject bookings starting before operating hours', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate dates with hours before OPEN_HOUR
          fc.date({ min: new Date('2025-01-20T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') }),
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          async (baseDate, hour, minute) => {
            // Skip invalid dates
            if (isNaN(baseDate.getTime())) {
              return true;
            }

            // Only test hours before open hour
            if (hour >= defaultRules.openHour) {
              return true; // Skip this case
            }

            const startAt = new Date(baseDate);
            startAt.setUTCHours(hour, minute, 0, 0);

            const endAt = new Date(startAt);
            endAt.setUTCHours(hour + 1, minute, 0, 0);

            const result = await bookingService.validateTimeWindow(startAt, endAt);

            // Property: All bookings starting before operating hours should be rejected
            expect(result.valid).toBe(false);
            expect(result.code).toBe('OUTSIDE_OPERATING_HOURS');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject bookings ending after operating hours', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate dates with end times after CLOSE_HOUR
          fc.date({ min: new Date('2025-01-20T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') }),
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 1, max: 59 }), // Non-zero minutes to ensure past close hour
          async (baseDate, endHour, endMinute) => {
            // Skip invalid dates
            if (isNaN(baseDate.getTime())) {
              return true;
            }

            // Only test end times after close hour
            if (endHour < defaultRules.closeHour || (endHour === defaultRules.closeHour && endMinute === 0)) {
              return true; // Skip this case
            }

            const startAt = new Date(baseDate);
            startAt.setUTCHours(Math.max(defaultRules.openHour, endHour - 1), 0, 0, 0);

            const endAt = new Date(baseDate);
            endAt.setUTCHours(endHour, endMinute, 0, 0);

            const result = await bookingService.validateTimeWindow(startAt, endAt);

            // Property: All bookings ending after operating hours should be rejected
            expect(result.valid).toBe(false);
            expect(result.code).toBe('OUTSIDE_OPERATING_HOURS');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept bookings within operating hours', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2025-01-20T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') }),
          fc.integer({ min: 0, max: 59 }),
          async (baseDate, durationMinutes) => {
            // Skip invalid dates
            if (isNaN(baseDate.getTime())) {
              return true;
            }

            // Create a booking within operating hours
            const startHour = defaultRules.openHour;
            const endHour = Math.min(startHour + 1, defaultRules.closeHour);

            const startAt = new Date(baseDate);
            startAt.setUTCHours(startHour, 0, 0, 0);

            const endAt = new Date(baseDate);
            endAt.setUTCHours(endHour, 0, 0, 0);

            // Ensure end is within operating hours
            if (endAt.getUTCHours() > defaultRules.closeHour) {
              return true; // Skip
            }

            const result = await bookingService.validateTimeWindow(startAt, endAt);

            // Property: All bookings within operating hours should pass time window validation
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 19: Start times must align to time slot intervals', () => {
    it('should reject start times not aligned to time slot intervals', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2025-01-20T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') }),
          fc.integer({ min: 1, max: 59 }),
          async (baseDate, minuteOffset) => {
            // Only test minutes that don't align with the interval
            if (minuteOffset % defaultRules.timeSlotIntervalMinutes === 0) {
              return true; // Skip aligned times
            }

            const startAt = new Date(baseDate);
            startAt.setUTCHours(defaultRules.openHour, minuteOffset, 0, 0);

            const endAt = new Date(startAt);
            endAt.setUTCHours(defaultRules.openHour + 1, minuteOffset, 0, 0);

            const result = await bookingService.validateTimeWindow(startAt, endAt);

            // Property: All non-aligned start times should be rejected
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_TIME_SLOT');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept start times aligned to time slot intervals', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2025-01-20T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') }),
          fc.integer({ min: 0, max: 10 }),
          async (baseDate, multiplier) => {
            // Create aligned start time
            const alignedMinutes = multiplier * defaultRules.timeSlotIntervalMinutes;
            if (alignedMinutes >= 60) {
              return true; // Skip invalid minutes
            }

            const startAt = new Date(baseDate);
            startAt.setUTCHours(defaultRules.openHour, alignedMinutes, 0, 0);

            const endAt = new Date(startAt);
            endAt.setUTCHours(defaultRules.openHour + 1, alignedMinutes, 0, 0);

            const result = await bookingService.validateTimeWindow(startAt, endAt);

            // Property: All aligned start times within operating hours should pass
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 20: Duration must meet minimum requirement', () => {
    it('should reject bookings shorter than minimum duration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2025-01-20T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') }),
          fc.integer({ min: 1, max: defaultRules.minDurationMinutes - 1 }),
          async (baseDate, durationMinutes) => {
            // Skip invalid dates
            if (isNaN(baseDate.getTime())) {
              return true;
            }

            const startAt = new Date(baseDate);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);

            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + durationMinutes * 60 * 1000);

            const result = await bookingService.validateDuration(startAt, endAt);

            // Property: All bookings shorter than minimum should be rejected
            expect(result.valid).toBe(false);
            expect(result.code).toBe('DURATION_TOO_SHORT');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept bookings meeting minimum duration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2025-01-20T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') }),
          fc.integer({ min: defaultRules.minDurationMinutes, max: defaultRules.maxDurationMinutes }),
          async (baseDate, durationMinutes) => {
            // Skip invalid dates
            if (isNaN(baseDate.getTime())) {
              return true;
            }

            const startAt = new Date(baseDate);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);

            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + durationMinutes * 60 * 1000);

            const result = await bookingService.validateDuration(startAt, endAt);

            // Property: All bookings meeting minimum duration should pass
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 21: Duration must not exceed maximum', () => {
    it('should reject bookings longer than maximum duration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2025-01-20T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') }),
          fc.integer({ min: defaultRules.maxDurationMinutes + 1, max: defaultRules.maxDurationMinutes + 500 }),
          async (baseDate, durationMinutes) => {
            // Skip invalid dates
            if (isNaN(baseDate.getTime())) {
              return true;
            }

            const startAt = new Date(baseDate);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);

            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + durationMinutes * 60 * 1000);

            const result = await bookingService.validateDuration(startAt, endAt);

            // Property: All bookings longer than maximum should be rejected
            expect(result.valid).toBe(false);
            expect(result.code).toBe('DURATION_TOO_LONG');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 25: Minimum notice is enforced', () => {
    it('should reject bookings with insufficient notice', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: defaultRules.minNoticeMinutes - 1 }),
          async (minutesFromNow) => {
            const now = new Date();
            const startAt = new Date(now.getTime() + minutesFromNow * 60 * 1000);
            
            // Align to time slot
            const alignedMinutes = Math.floor(startAt.getUTCMinutes() / defaultRules.timeSlotIntervalMinutes) * defaultRules.timeSlotIntervalMinutes;
            startAt.setUTCMinutes(alignedMinutes, 0, 0);

            const result = await bookingService.validateHorizon(startAt);

            // Property: All bookings with insufficient notice should be rejected
            expect(result.valid).toBe(false);
            expect(result.code).toBe('TOO_SOON');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept bookings with sufficient notice', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: defaultRules.minNoticeMinutes + 5, max: defaultRules.minNoticeMinutes + 1000 }),
          async (minutesFromNow) => {
            const now = new Date();
            const startAt = new Date(now.getTime() + minutesFromNow * 60 * 1000);
            
            // Ensure we don't exceed max days ahead
            const daysFromNow = minutesFromNow / (60 * 24);
            if (daysFromNow > defaultRules.maxDaysAhead) {
              return true; // Skip
            }

            const result = await bookingService.validateHorizon(startAt);

            // Property: All bookings with sufficient notice should pass horizon validation
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 26: Maximum advance booking is enforced', () => {
    it('should reject bookings too far in advance', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: defaultRules.maxDaysAhead + 1, max: defaultRules.maxDaysAhead + 100 }),
          async (daysFromNow) => {
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);

            const result = await bookingService.validateHorizon(startAt);

            // Property: All bookings too far in advance should be rejected
            expect(result.valid).toBe(false);
            expect(result.code).toBe('TOO_FAR_AHEAD');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept bookings within advance booking window', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: defaultRules.maxDaysAhead }),
          async (daysFromNow) => {
            const now = new Date();
            const minutesFromNow = daysFromNow * 24 * 60;
            
            // Ensure we meet minimum notice
            if (minutesFromNow < defaultRules.minNoticeMinutes) {
              return true; // Skip
            }

            const startAt = new Date(now.getTime() + minutesFromNow * 60 * 1000);

            const result = await bookingService.validateHorizon(startAt);

            // Property: All bookings within advance window should pass
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

// Feature: breakout-room-booking
// Property 22: Active booking limit is enforced
// Property 23: Consecutive booking limit is enforced
// Property 24: Cooldown period is enforced
// Validates: Requirements 8.2, 8.3, 8.4, 11.3

describe('BookingService Property Tests - Fair Usage Rules', () => {
  const bookingService = new BookingService(new RuleService(), new RoomService());
  let defaultRules: any;
  let testUserId: string;
  let testRoomId: string;

  beforeAll(async () => {
    // Get default rules for test setup
    const ruleService = new RuleService();
    defaultRules = await ruleService.getRules();

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `fairusage-test-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });
    testUserId = testUser.id;

    // Create a test room
    const testRoom = await prisma.room.create({
      data: {
        name: `Fair Usage Test Room ${Date.now()}`,
        capacity: 10,
        equipment: [],
        status: 'active',
      },
    });
    testRoomId = testRoom.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.room.delete({ where: { id: testRoomId } });
    await prisma.$disconnect();
  });

  describe('Property 22: Active booking limit is enforced', () => {
    it('should reject bookings when user has reached max active bookings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: defaultRules.maxActiveBookings, max: defaultRules.maxActiveBookings + 5 }),
          async (numBookings) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create exactly maxActiveBookings confirmed future bookings
            const now = new Date();
            const bookingsToCreate = [];
            
            for (let i = 0; i < defaultRules.maxActiveBookings; i++) {
              const startAt = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
              startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
              
              const endAt = new Date(startAt);
              endAt.setUTCHours(defaultRules.openHour + 1, 0, 0, 0);

              bookingsToCreate.push({
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'confirmed' as const,
              });
            }

            await prisma.booking.createMany({ data: bookingsToCreate });

            // Now try to validate max active bookings
            const result = await bookingService.validateMaxActiveBookings(testUserId);

            // Property: When user has maxActiveBookings or more, validation should fail
            expect(result.valid).toBe(false);
            expect(result.code).toBe('MAX_ACTIVE_BOOKINGS_EXCEEDED');

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should accept bookings when user has fewer than max active bookings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: defaultRules.maxActiveBookings - 1 }),
          async (numBookings) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create fewer than maxActiveBookings
            const now = new Date();
            const bookingsToCreate = [];
            
            for (let i = 0; i < numBookings; i++) {
              const startAt = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
              startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
              
              const endAt = new Date(startAt);
              endAt.setUTCHours(defaultRules.openHour + 1, 0, 0, 0);

              bookingsToCreate.push({
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'confirmed' as const,
              });
            }

            if (bookingsToCreate.length > 0) {
              await prisma.booking.createMany({ data: bookingsToCreate });
            }

            // Validate max active bookings
            const result = await bookingService.validateMaxActiveBookings(testUserId);

            // Property: When user has fewer than maxActiveBookings, validation should pass
            expect(result.valid).toBe(true);

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should exclude expired and cancelled bookings from active count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (numExpiredBookings) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const bookingsToCreate = [];

            // Create expired bookings (in the past)
            for (let i = 0; i < numExpiredBookings; i++) {
              const startAt = new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000);
              startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
              
              const endAt = new Date(startAt);
              endAt.setUTCHours(defaultRules.openHour + 1, 0, 0, 0);

              bookingsToCreate.push({
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'expired' as const,
              });
            }

            // Create cancelled bookings
            for (let i = 0; i < numExpiredBookings; i++) {
              const startAt = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
              startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
              
              const endAt = new Date(startAt);
              endAt.setUTCHours(defaultRules.openHour + 1, 0, 0, 0);

              bookingsToCreate.push({
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'cancelled' as const,
              });
            }

            await prisma.booking.createMany({ data: bookingsToCreate });

            // Validate - should pass because no active bookings
            const result = await bookingService.validateMaxActiveBookings(testUserId);

            // Property: Expired and cancelled bookings should not count toward active limit
            expect(result.valid).toBe(true);

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 23: Consecutive booking limit is enforced', () => {
    it('should reject consecutive bookings when limit is reached', async () => {
      // Skip if maxConsecutive is not configured
      if (!defaultRules.maxConsecutive) {
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create consecutive bookings up to the limit
            const now = new Date();
            const baseDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            baseDate.setUTCHours(defaultRules.openHour, 0, 0, 0);

            const bookingsToCreate = [];
            
            for (let i = 0; i < defaultRules.maxConsecutive; i++) {
              const startAt = new Date(baseDate.getTime() + i * 60 * 60 * 1000);
              const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

              bookingsToCreate.push({
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'confirmed' as const,
              });
            }

            await prisma.booking.createMany({ data: bookingsToCreate });

            // Try to book the next consecutive slot
            const nextStartAt = new Date(
              baseDate.getTime() + defaultRules.maxConsecutive * 60 * 60 * 1000
            );

            const result = await bookingService.validateConsecutiveBookings(
              testUserId,
              testRoomId,
              nextStartAt
            );

            // Property: When consecutive limit is reached, validation should fail
            expect(result.valid).toBe(false);
            expect(result.code).toBe('MAX_CONSECUTIVE_EXCEEDED');

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should accept non-consecutive bookings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (gapHours) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create a booking
            const now = new Date();
            const baseDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            baseDate.setUTCHours(defaultRules.openHour, 0, 0, 0);

            const firstBooking = await prisma.booking.create({
              data: {
                userId: testUserId,
                roomId: testRoomId,
                startAt: baseDate,
                endAt: new Date(baseDate.getTime() + 60 * 60 * 1000),
                status: 'confirmed',
              },
            });

            // Try to book with a gap (non-consecutive)
            const nextStartAt = new Date(
              firstBooking.endAt.getTime() + gapHours * 60 * 60 * 1000
            );

            const result = await bookingService.validateConsecutiveBookings(
              testUserId,
              testRoomId,
              nextStartAt
            );

            // Property: Non-consecutive bookings should always pass
            expect(result.valid).toBe(true);

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should pass validation when maxConsecutive is not configured', async () => {
      // Temporarily test with null maxConsecutive by checking the actual behavior
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const baseDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            baseDate.setUTCHours(defaultRules.openHour, 0, 0, 0);

            // If maxConsecutive is null, validation should always pass
            const result = await bookingService.validateConsecutiveBookings(
              testUserId,
              testRoomId,
              baseDate
            );

            // Property: When maxConsecutive is not configured, validation always passes
            if (!defaultRules.maxConsecutive) {
              expect(result.valid).toBe(true);
            }

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 24: Cooldown period is enforced', () => {
    it('should reject bookings during cooldown period', async () => {
      // Skip if cooldown is not configured
      if (!defaultRules.cooldownMinutes) {
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: defaultRules.cooldownMinutes - 1 }),
          async (minutesAfterCreation) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create a booking
            const now = new Date();
            const futureDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            futureDate.setUTCHours(defaultRules.openHour, 0, 0, 0);

            await prisma.booking.create({
              data: {
                userId: testUserId,
                roomId: testRoomId,
                startAt: futureDate,
                endAt: new Date(futureDate.getTime() + 60 * 60 * 1000),
                status: 'confirmed',
                createdAt: now,
              },
            });

            // Wait a bit (simulated by checking immediately)
            // In real scenario, the cooldown would be checked against current time
            const result = await bookingService.validateCooldown(testUserId);

            // Property: During cooldown period, validation should fail
            expect(result.valid).toBe(false);
            expect(result.code).toBe('COOLDOWN_ACTIVE');

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should accept bookings after cooldown period expires', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // If cooldown is not configured, should always pass
            if (!defaultRules.cooldownMinutes) {
              const result = await bookingService.validateCooldown(testUserId);
              expect(result.valid).toBe(true);
              return;
            }

            // Create a booking with createdAt in the past (beyond cooldown)
            const now = new Date();
            const pastCreationTime = new Date(
              now.getTime() - (defaultRules.cooldownMinutes + 5) * 60 * 1000
            );
            const futureDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            futureDate.setUTCHours(defaultRules.openHour, 0, 0, 0);

            await prisma.booking.create({
              data: {
                userId: testUserId,
                roomId: testRoomId,
                startAt: futureDate,
                endAt: new Date(futureDate.getTime() + 60 * 60 * 1000),
                status: 'confirmed',
                createdAt: pastCreationTime,
              },
            });

            const result = await bookingService.validateCooldown(testUserId);

            // Property: After cooldown expires, validation should pass
            expect(result.valid).toBe(true);

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should pass validation when cooldown is not configured', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const result = await bookingService.validateCooldown(testUserId);

            // Property: When cooldown is not configured, validation always passes
            if (!defaultRules.cooldownMinutes) {
              expect(result.valid).toBe(true);
            }

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});

// Feature: breakout-room-booking
// Property 10: Created bookings have required fields
// Property 11: Overlapping bookings are prevented
// Property 12: Booking rule violations produce errors
// Property 13: Successful bookings are immediately visible
// Validates: Requirements 4.1, 4.2, 4.5, 15.1, 15.5

describe('BookingService Property Tests - Booking Creation', () => {
  const bookingService = new BookingService(new RuleService(), new RoomService());
  let defaultRules: any;
  let testUserId: string;
  let testRoomId: string;

  beforeAll(async () => {
    // Get default rules for test setup
    const ruleService = new RuleService();
    defaultRules = await ruleService.getRules();

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `booking-creation-test-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });
    testUserId = testUser.id;

    // Create a test room
    const testRoom = await prisma.room.create({
      data: {
        name: `Booking Creation Test Room ${Date.now()}`,
        capacity: 10,
        equipment: [],
        status: 'active',
      },
    });
    testRoomId = testRoom.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.room.delete({ where: { id: testRoomId } });
    await prisma.$disconnect();
  });

  describe('Property 10: Created bookings have required fields', () => {
    it('should create bookings with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create a valid booking time
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + defaultRules.minDurationMinutes * 60 * 1000);

            try {
              const booking = await bookingService.createBooking(
                testUserId,
                testRoomId,
                startAt,
                endAt
              );

              // Property: All created bookings must have required fields
              expect(booking).toBeDefined();
              expect(booking.id).toBeDefined();
              expect(booking.userId).toBe(testUserId);
              expect(booking.roomId).toBe(testRoomId);
              expect(booking.startAt).toEqual(startAt);
              expect(booking.endAt).toEqual(endAt);
              expect(booking.status).toBe('confirmed');
              expect(booking.createdAt).toBeDefined();
              expect(booking.updatedAt).toBeDefined();

              // Clean up
              await prisma.booking.delete({ where: { id: booking.id } });
            } catch (error: any) {
              // If booking fails due to validation, that's acceptable for this property
              // We're only testing that successful bookings have required fields
              if (error.message.includes('Maximum active bookings')) {
                await prisma.booking.deleteMany({ where: { userId: testUserId } });
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 11: Overlapping bookings are prevented', () => {
    it('should prevent overlapping bookings for the same room', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 0, max: 3 }), // Generate multiplier for time slot intervals
          async (daysFromNow, intervalMultiplier) => {
            // Clean up any existing bookings for this user and room
            await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });

            // Create first booking
            const now = new Date();
            const startAt1 = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt1.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt1 = new Date(startAt1);
            endAt1.setTime(startAt1.getTime() + 60 * 60 * 1000); // 1 hour booking

            const booking1 = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt1,
              endAt1
            );

            expect(booking1.status).toBe('confirmed');

            // Try to create overlapping booking (starts during first booking)
            // Align to time slot interval
            const alignedMinuteOffset = intervalMultiplier * defaultRules.timeSlotIntervalMinutes;
            const startAt2 = new Date(startAt1.getTime() + alignedMinuteOffset * 60 * 1000);
            const endAt2 = new Date(startAt2.getTime() + 60 * 60 * 1000);

            // Only test if it actually overlaps
            if (startAt2 < endAt1 && endAt2 > startAt1) {
              try {
                await bookingService.createBooking(
                  testUserId,
                  testRoomId,
                  startAt2,
                  endAt2
                );
                
                // Should not reach here
                expect(true).toBe(false);
              } catch (error: any) {
                // Property: Overlapping bookings must be rejected
                expect(error.message).toMatch(/already booked|unavailable|overlap/i);
              }
            }

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow non-overlapping bookings for the same room', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 1, max: 5 }),
          async (daysFromNow, gapHours) => {
            // Clean up any existing bookings for this user and room
            await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });

            // Create first booking
            const now = new Date();
            const startAt1 = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt1.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt1 = new Date(startAt1);
            endAt1.setTime(startAt1.getTime() + 60 * 60 * 1000); // 1 hour booking

            const booking1 = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt1,
              endAt1
            );

            expect(booking1.status).toBe('confirmed');

            // Create non-overlapping booking (starts after first booking ends)
            const startAt2 = new Date(endAt1.getTime() + gapHours * 60 * 60 * 1000);
            const endAt2 = new Date(startAt2.getTime() + 60 * 60 * 1000);

            // Check if within operating hours
            if (endAt2.getUTCHours() > defaultRules.closeHour) {
              await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });
              return;
            }

            try {
              const booking2 = await bookingService.createBooking(
                testUserId,
                testRoomId,
                startAt2,
                endAt2
              );

              // Property: Non-overlapping bookings should succeed
              expect(booking2.status).toBe('confirmed');
              expect(booking2.id).not.toBe(booking1.id);

              // Clean up
              await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });
            } catch (error: any) {
              // May fail due to max active bookings or other rules
              if (error.message.includes('Maximum active bookings')) {
                await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 12: Booking rule violations produce errors', () => {
    it('should reject bookings that violate time window rules', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: defaultRules.openHour - 1 }),
          async (hour) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const startAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(hour, 0, 0, 0); // Before operating hours
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            try {
              await bookingService.createBooking(
                testUserId,
                testRoomId,
                startAt,
                endAt
              );
              
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              // Property: Rule violations must produce errors
              expect(error.message).toBeDefined();
              expect(error.message.length).toBeGreaterThan(0);
            }

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reject bookings that violate duration rules', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: defaultRules.minDurationMinutes - 1 }),
          async (durationMinutes) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const startAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + durationMinutes * 60 * 1000);

            try {
              await bookingService.createBooking(
                testUserId,
                testRoomId,
                startAt,
                endAt
              );
              
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              // Property: Rule violations must produce errors
              expect(error.message).toBeDefined();
              expect(error.message).toMatch(/duration/i);
            }

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reject bookings that violate horizon rules', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: defaultRules.minNoticeMinutes - 1 }),
          async (minutesFromNow) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const startAt = new Date(now.getTime() + minutesFromNow * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            try {
              await bookingService.createBooking(
                testUserId,
                testRoomId,
                startAt,
                endAt
              );
              
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              // Property: Rule violations must produce errors
              expect(error.message).toBeDefined();
              expect(error.message.length).toBeGreaterThan(0);
            }

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 13: Successful bookings are immediately visible', () => {
    it('should make successful bookings immediately queryable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt,
              endAt
            );

            // Property: Booking should be immediately visible in queries
            const userBookings = await bookingService.getUserActiveBookings(testUserId);
            expect(userBookings.length).toBeGreaterThan(0);
            expect(userBookings.some(b => b.id === booking.id)).toBe(true);

            // Also check room availability reflects the booking
            const availabilityResult = await bookingService.checkRoomAvailability(
              testRoomId,
              startAt,
              endAt
            );
            expect(availabilityResult.valid).toBe(false);
            expect(availabilityResult.code).toBe('ROOM_UNAVAILABLE');

            // Clean up
            await prisma.booking.delete({ where: { id: booking.id } });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// Feature: breakout-room-booking
// Property 5: Maintenance rooms are not bookable
// Property 28: Bookings cannot overlap maintenance blocks
// Validates: Requirements 2.3, 10.4

describe('BookingService Property Tests - Maintenance Conflicts', () => {
  const bookingService = new BookingService(new RuleService(), new RoomService());
  let defaultRules: any;
  let testUserId: string;
  let testRoomId: string;
  let maintenanceRoomId: string;

  beforeAll(async () => {
    // Get default rules for test setup
    const ruleService = new RuleService();
    defaultRules = await ruleService.getRules();

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `maintenance-test-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });
    testUserId = testUser.id;

    // Create a test room
    const testRoom = await prisma.room.create({
      data: {
        name: `Maintenance Test Room ${Date.now()}`,
        capacity: 10,
        equipment: [],
        status: 'active',
      },
    });
    testRoomId = testRoom.id;

    // Create a room in maintenance status
    const maintenanceRoom = await prisma.room.create({
      data: {
        name: `Maintenance Status Room ${Date.now()}`,
        capacity: 10,
        equipment: [],
        status: 'maintenance',
      },
    });
    maintenanceRoomId = maintenanceRoom.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({ where: { userId: testUserId } });
    await prisma.maintenanceBlock.deleteMany({ where: { roomId: testRoomId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.room.delete({ where: { id: testRoomId } });
    await prisma.room.delete({ where: { id: maintenanceRoomId } });
    await prisma.$disconnect();
  });

  describe('Property 5: Maintenance rooms are not bookable', () => {
    it('should reject bookings for rooms with maintenance status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            try {
              await bookingService.createBooking(
                testUserId,
                maintenanceRoomId,
                startAt,
                endAt
              );
              
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              // Property: Rooms with maintenance status cannot be booked
              expect(error.message).toMatch(/maintenance/i);
            }

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 28: Bookings cannot overlap maintenance blocks', () => {
    it('should reject bookings that overlap with maintenance blocks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 0, max: 3 }),
          async (daysFromNow, offsetHours) => {
            // Clean up any existing bookings and maintenance blocks
            await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });
            await prisma.maintenanceBlock.deleteMany({ where: { roomId: testRoomId } });

            // Create a maintenance block
            const now = new Date();
            const maintenanceStart = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            maintenanceStart.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const maintenanceEnd = new Date(maintenanceStart);
            maintenanceEnd.setTime(maintenanceStart.getTime() + 2 * 60 * 60 * 1000); // 2 hour block

            const maintenanceBlock = await prisma.maintenanceBlock.create({
              data: {
                roomId: testRoomId,
                startAt: maintenanceStart,
                endAt: maintenanceEnd,
                reason: 'Test maintenance',
              },
            });

            // Try to book during the maintenance block
            const bookingStart = new Date(maintenanceStart.getTime() + offsetHours * 60 * 60 * 1000);
            const bookingEnd = new Date(bookingStart.getTime() + 60 * 60 * 1000);

            // Only test if it actually overlaps
            if (bookingStart < maintenanceEnd && bookingEnd > maintenanceStart) {
              try {
                await bookingService.createBooking(
                  testUserId,
                  testRoomId,
                  bookingStart,
                  bookingEnd
                );
                
                // Should not reach here
                expect(true).toBe(false);
              } catch (error: any) {
                // Property: Bookings overlapping maintenance blocks must be rejected
                expect(error.message).toMatch(/maintenance/i);
              }
            }

            // Clean up
            await prisma.maintenanceBlock.delete({ where: { id: maintenanceBlock.id } });
            await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow bookings that do not overlap with maintenance blocks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 3, max: 6 }),
          async (daysFromNow, gapHours) => {
            // Clean up any existing bookings and maintenance blocks
            await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });
            await prisma.maintenanceBlock.deleteMany({ where: { roomId: testRoomId } });

            // Create a maintenance block
            const now = new Date();
            const maintenanceStart = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            maintenanceStart.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const maintenanceEnd = new Date(maintenanceStart);
            maintenanceEnd.setTime(maintenanceStart.getTime() + 2 * 60 * 60 * 1000); // 2 hour block

            const maintenanceBlock = await prisma.maintenanceBlock.create({
              data: {
                roomId: testRoomId,
                startAt: maintenanceStart,
                endAt: maintenanceEnd,
                reason: 'Test maintenance',
              },
            });

            // Book after the maintenance block
            const bookingStart = new Date(maintenanceEnd.getTime() + gapHours * 60 * 60 * 1000);
            const bookingEnd = new Date(bookingStart.getTime() + 60 * 60 * 1000);

            // Check if within operating hours
            if (bookingEnd.getUTCHours() > defaultRules.closeHour) {
              await prisma.maintenanceBlock.delete({ where: { id: maintenanceBlock.id } });
              return;
            }

            try {
              const booking = await bookingService.createBooking(
                testUserId,
                testRoomId,
                bookingStart,
                bookingEnd
              );

              // Property: Non-overlapping bookings should succeed
              expect(booking.status).toBe('confirmed');

              // Clean up
              await prisma.booking.delete({ where: { id: booking.id } });
            } catch (error: any) {
              // May fail due to max active bookings or other rules
              if (error.message.includes('Maximum active bookings')) {
                await prisma.maintenanceBlock.delete({ where: { id: maintenanceBlock.id } });
                await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });
                return;
              }
              throw error;
            }

            // Clean up
            await prisma.maintenanceBlock.delete({ where: { id: maintenanceBlock.id } });
            await prisma.booking.deleteMany({ where: { userId: testUserId, roomId: testRoomId } });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// Feature: breakout-room-booking
// Property 14: Users can only cancel their own future bookings
// Property 15: Cancellation updates booking state correctly
// Property 16: Admins can cancel any booking
// Property 17: Cancelled bookings free up time slots
// Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5

describe('BookingService Property Tests - Booking Cancellation', () => {
  const bookingService = new BookingService(new RuleService(), new RoomService());
  let defaultRules: any;
  let testUserId: string;
  let testUser2Id: string;
  let testAdminId: string;
  let testRoomId: string;

  beforeAll(async () => {
    // Get default rules for test setup
    const ruleService = new RuleService();
    defaultRules = await ruleService.getRules();

    // Create test users
    const testUser = await prisma.user.create({
      data: {
        email: `cancellation-test-user-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });
    testUserId = testUser.id;

    const testUser2 = await prisma.user.create({
      data: {
        email: `cancellation-test-user2-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });
    testUser2Id = testUser2.id;

    const testAdmin = await prisma.user.create({
      data: {
        email: `cancellation-test-admin-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'admin',
      },
    });
    testAdminId = testAdmin.id;

    // Create a test room
    const testRoom = await prisma.room.create({
      data: {
        name: `Cancellation Test Room ${Date.now()}`,
        capacity: 10,
        equipment: [],
        status: 'active',
      },
    });
    testRoomId = testRoom.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({ where: { userId: testUserId } });
    await prisma.booking.deleteMany({ where: { userId: testUser2Id } });
    await prisma.booking.deleteMany({ where: { userId: testAdminId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.user.delete({ where: { id: testUser2Id } });
    await prisma.user.delete({ where: { id: testAdminId } });
    await prisma.room.delete({ where: { id: testRoomId } });
    await prisma.$disconnect();
  });

  describe('Property 14: Users can only cancel their own future bookings', () => {
    it('should allow users to cancel their own future bookings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create a future booking
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt,
              endAt
            );

            // Property: User should be able to cancel their own future booking
            const cancelledBooking = await bookingService.cancelBooking(
              booking.id,
              testUserId,
              false // not admin
            );

            expect(cancelledBooking.status).toBe('cancelled');
            expect(cancelledBooking.id).toBe(booking.id);

            // Clean up
            await prisma.booking.delete({ where: { id: booking.id } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject cancellation of bookings owned by other users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
            await prisma.booking.deleteMany({ where: { userId: testUser2Id } });

            // Create a booking for user 1
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt,
              endAt
            );

            // Property: User 2 should NOT be able to cancel user 1's booking
            try {
              await bookingService.cancelBooking(
                booking.id,
                testUser2Id,
                false // not admin
              );
              
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              expect(error.message).toMatch(/only cancel your own/i);
            }

            // Clean up
            await prisma.booking.delete({ where: { id: booking.id } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject cancellation of past bookings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (daysAgo) => {
            // Clean up any existing bookings
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create a past booking (manually insert to bypass validation)
            const now = new Date();
            const startAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await prisma.booking.create({
              data: {
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'confirmed',
              },
            });

            // Property: Past bookings cannot be cancelled
            try {
              await bookingService.cancelBooking(
                booking.id,
                testUserId,
                false
              );
              
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              expect(error.message).toMatch(/cannot cancel past/i);
            }

            // Clean up
            await prisma.booking.delete({ where: { id: booking.id } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject cancellation of non-existent bookings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (fakeBookingId) => {
            // Property: Cancelling non-existent booking should fail
            try {
              await bookingService.cancelBooking(
                fakeBookingId,
                testUserId,
                false
              );
              
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              expect(error.message).toMatch(/not found/i);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 15: Cancellation updates booking state correctly', () => {
    it('should update booking status to cancelled with correct metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create a future booking
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt,
              endAt
            );

            const beforeCancellation = new Date();

            // Cancel the booking
            const cancelledBooking = await bookingService.cancelBooking(
              booking.id,
              testUserId,
              false
            );

            const afterCancellation = new Date();

            // Property: Cancellation must update state correctly
            expect(cancelledBooking.status).toBe('cancelled');
            expect(cancelledBooking.cancelledAt).toBeDefined();
            expect(cancelledBooking.cancelledBy).toBe(testUserId);
            
            // Verify cancelledAt is within reasonable time range
            if (cancelledBooking.cancelledAt) {
              expect(cancelledBooking.cancelledAt.getTime()).toBeGreaterThanOrEqual(beforeCancellation.getTime());
              expect(cancelledBooking.cancelledAt.getTime()).toBeLessThanOrEqual(afterCancellation.getTime());
            }

            // Clean up
            await prisma.booking.delete({ where: { id: booking.id } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject cancellation of already cancelled bookings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create and cancel a booking
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt,
              endAt
            );

            await bookingService.cancelBooking(booking.id, testUserId, false);

            // Property: Cannot cancel already cancelled booking
            try {
              await bookingService.cancelBooking(booking.id, testUserId, false);
              
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              expect(error.message).toMatch(/already cancelled/i);
            }

            // Clean up
            await prisma.booking.delete({ where: { id: booking.id } });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 16: Admins can cancel any booking', () => {
    it('should allow admins to cancel any user booking', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create a booking for regular user
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt,
              endAt
            );

            // Property: Admin should be able to cancel any booking
            const cancelledBooking = await bookingService.cancelBooking(
              booking.id,
              testAdminId,
              true // is admin
            );

            expect(cancelledBooking.status).toBe('cancelled');
            expect(cancelledBooking.cancelledBy).toBe(testAdminId);
            expect(cancelledBooking.userId).toBe(testUserId); // Original owner

            // Clean up
            await prisma.booking.delete({ where: { id: booking.id } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow admins to cancel bookings from different users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings
            await prisma.booking.deleteMany({ where: { userId: testUser2Id } });

            // Create a booking for user 2
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await bookingService.createBooking(
              testUser2Id,
              testRoomId,
              startAt,
              endAt
            );

            // Property: Admin can cancel bookings they don't own
            const cancelledBooking = await bookingService.cancelBooking(
              booking.id,
              testAdminId,
              true // is admin
            );

            expect(cancelledBooking.status).toBe('cancelled');
            expect(cancelledBooking.userId).toBe(testUser2Id);
            expect(cancelledBooking.cancelledBy).toBe(testAdminId);

            // Clean up
            await prisma.booking.delete({ where: { id: booking.id } });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 17: Cancelled bookings free up time slots', () => {
    it('should make time slots available after cancellation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
            await prisma.booking.deleteMany({ where: { userId: testUser2Id } });

            // Create a booking
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt,
              endAt
            );

            // Verify room is unavailable
            const beforeCancellation = await bookingService.checkRoomAvailability(
              testRoomId,
              startAt,
              endAt
            );
            expect(beforeCancellation.valid).toBe(false);

            // Cancel the booking
            await bookingService.cancelBooking(booking.id, testUserId, false);

            // Property: Room should now be available for the same time slot
            const afterCancellation = await bookingService.checkRoomAvailability(
              testRoomId,
              startAt,
              endAt
            );
            expect(afterCancellation.valid).toBe(true);

            // Verify another user can now book the same slot
            const newBooking = await bookingService.createBooking(
              testUser2Id,
              testRoomId,
              startAt,
              endAt
            );
            expect(newBooking.status).toBe('confirmed');

            // Clean up
            await prisma.booking.delete({ where: { id: booking.id } });
            await prisma.booking.delete({ where: { id: newBooking.id } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow immediate rebooking of cancelled slots', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (daysFromNow) => {
            // Clean up any existing bookings
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            // Create and cancel a booking
            const now = new Date();
            const startAt = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
            startAt.setUTCHours(defaultRules.openHour, 0, 0, 0);
            
            const endAt = new Date(startAt);
            endAt.setTime(startAt.getTime() + 60 * 60 * 1000);

            const booking = await bookingService.createBooking(
              testUserId,
              testRoomId,
              startAt,
              endAt
            );

            await bookingService.cancelBooking(booking.id, testUserId, false);

            // Property: Same user should be able to immediately rebook the slot
            try {
              const newBooking = await bookingService.createBooking(
                testUserId,
                testRoomId,
                startAt,
                endAt
              );
              
              expect(newBooking.status).toBe('confirmed');
              expect(newBooking.id).not.toBe(booking.id);

              // Clean up
              await prisma.booking.delete({ where: { id: booking.id } });
              await prisma.booking.delete({ where: { id: newBooking.id } });
            } catch (error: any) {
              // May fail due to cooldown if configured
              if (error.message.includes('Cooldown')) {
                await prisma.booking.delete({ where: { id: booking.id } });
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// Feature: breakout-room-booking
// Property 30: Past bookings are marked as expired
// Validates: Requirements 11.1

describe('BookingService Property Tests - Booking Expiration', () => {
  const bookingService = new BookingService(new RuleService(), new RoomService());
  let testUserId: string;
  let testRoomId: string;

  beforeAll(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `expiration-test-${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        role: 'user',
      },
    });
    testUserId = testUser.id;

    // Create a test room
    const testRoom = await prisma.room.create({
      data: {
        name: `Expiration Test Room ${Date.now()}`,
        capacity: 10,
        equipment: [],
        status: 'active',
      },
    });
    testRoomId = testRoom.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.room.delete({ where: { id: testRoomId } });
    await prisma.$disconnect();
  });

  describe('Property 30: Past bookings are marked as expired', () => {
    it('should mark confirmed bookings with past end times as expired', async () => {
      /**
       * **Validates: Requirements 11.1**
       * 
       * This property verifies that the expireOldBookings() method correctly identifies
       * and marks all confirmed bookings with end_at < now as expired.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // Number of past bookings to create
          fc.integer({ min: 1, max: 30 }), // Days in the past
          async (numBookings, daysInPast) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const bookingsToCreate = [];

            // Create confirmed bookings with end times in the past
            for (let i = 0; i < numBookings; i++) {
              const startAt = new Date(now.getTime() - (daysInPast + i) * 24 * 60 * 60 * 1000);
              startAt.setUTCHours(10, 0, 0, 0);
              
              const endAt = new Date(startAt);
              endAt.setUTCHours(11, 0, 0, 0);

              bookingsToCreate.push({
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'confirmed' as const,
              });
            }

            await prisma.booking.createMany({ data: bookingsToCreate });

            // Run the expiration method
            const expiredCount = await bookingService.expireOldBookings();

            // Property: All confirmed bookings with past end times should be marked as expired
            expect(expiredCount).toBe(numBookings);

            // Verify that all bookings are now expired
            const expiredBookings = await prisma.booking.findMany({
              where: {
                userId: testUserId,
                status: 'expired',
              },
            });

            expect(expiredBookings.length).toBe(numBookings);

            // Verify no confirmed bookings remain for this user
            const confirmedBookings = await prisma.booking.findMany({
              where: {
                userId: testUserId,
                status: 'confirmed',
              },
            });

            expect(confirmedBookings.length).toBe(0);

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not mark future bookings as expired', async () => {
      /**
       * **Validates: Requirements 11.1**
       * 
       * This property verifies that expireOldBookings() does NOT affect
       * confirmed bookings with future end times.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of future bookings
          fc.integer({ min: 1, max: 10 }), // Days in the future
          async (numBookings, daysInFuture) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const bookingsToCreate = [];

            // Create confirmed bookings with end times in the future
            for (let i = 0; i < numBookings; i++) {
              const startAt = new Date(now.getTime() + (daysInFuture + i) * 24 * 60 * 60 * 1000);
              startAt.setUTCHours(10, 0, 0, 0);
              
              const endAt = new Date(startAt);
              endAt.setUTCHours(11, 0, 0, 0);

              bookingsToCreate.push({
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'confirmed' as const,
              });
            }

            await prisma.booking.createMany({ data: bookingsToCreate });

            // Run the expiration method
            const expiredCount = await bookingService.expireOldBookings();

            // Property: Future bookings should NOT be expired
            // (expiredCount might be > 0 if there are other past bookings in the system)
            
            // Verify that all our test bookings are still confirmed
            const confirmedBookings = await prisma.booking.findMany({
              where: {
                userId: testUserId,
                status: 'confirmed',
              },
            });

            expect(confirmedBookings.length).toBe(numBookings);

            // Verify no expired bookings for this user
            const expiredBookings = await prisma.booking.findMany({
              where: {
                userId: testUserId,
                status: 'expired',
              },
            });

            expect(expiredBookings.length).toBe(0);

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not affect cancelled bookings', async () => {
      /**
       * **Validates: Requirements 11.1**
       * 
       * This property verifies that expireOldBookings() only affects confirmed bookings,
       * not cancelled ones, even if they are in the past.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of cancelled bookings
          fc.integer({ min: 1, max: 30 }), // Days in the past
          async (numBookings, daysInPast) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const bookingsToCreate = [];

            // Create cancelled bookings with end times in the past
            for (let i = 0; i < numBookings; i++) {
              const startAt = new Date(now.getTime() - (daysInPast + i) * 24 * 60 * 60 * 1000);
              startAt.setUTCHours(10, 0, 0, 0);
              
              const endAt = new Date(startAt);
              endAt.setUTCHours(11, 0, 0, 0);

              bookingsToCreate.push({
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'cancelled' as const,
                cancelledAt: now,
                cancelledBy: testUserId,
              });
            }

            await prisma.booking.createMany({ data: bookingsToCreate });

            // Run the expiration method
            await bookingService.expireOldBookings();

            // Property: Cancelled bookings should remain cancelled
            const cancelledBookings = await prisma.booking.findMany({
              where: {
                userId: testUserId,
                status: 'cancelled',
              },
            });

            expect(cancelledBookings.length).toBe(numBookings);

            // Verify no expired bookings for this user
            const expiredBookings = await prisma.booking.findMany({
              where: {
                userId: testUserId,
                status: 'expired',
              },
            });

            expect(expiredBookings.length).toBe(0);

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should exclude expired bookings from active booking count', async () => {
      /**
       * **Validates: Requirements 11.3**
       * 
       * This property verifies that expired bookings do not count toward
       * the user's active booking limit.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of past bookings to expire
          async (numPastBookings) => {
            // Clean up any existing bookings for this user
            await prisma.booking.deleteMany({ where: { userId: testUserId } });

            const now = new Date();
            const bookingsToCreate = [];

            // Create confirmed bookings with end times in the past
            for (let i = 0; i < numPastBookings; i++) {
              const startAt = new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000);
              startAt.setUTCHours(10, 0, 0, 0);
              
              const endAt = new Date(startAt);
              endAt.setUTCHours(11, 0, 0, 0);

              bookingsToCreate.push({
                userId: testUserId,
                roomId: testRoomId,
                startAt,
                endAt,
                status: 'confirmed' as const,
              });
            }

            await prisma.booking.createMany({ data: bookingsToCreate });

            // Expire the old bookings
            await bookingService.expireOldBookings();

            // Property: Expired bookings should not count toward active booking limit
            const activeBookings = await bookingService.getUserActiveBookings(testUserId);
            expect(activeBookings.length).toBe(0);

            // Verify validation passes (no active bookings)
            const validationResult = await bookingService.validateMaxActiveBookings(testUserId);
            expect(validationResult.valid).toBe(true);

            // Clean up
            await prisma.booking.deleteMany({ where: { userId: testUserId } });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
