import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { MaintenanceBlockService } from './maintenance.service';
import { RoomService } from './room.service';
import prisma from './db';
import { RoomStatus } from '@prisma/client';

describe('MaintenanceBlockService Property Tests', () => {
  const maintenanceBlockService = new MaintenanceBlockService();
  const roomService = new RoomService();

  afterEach(async () => {
    // Clean up test data - order matters due to foreign keys
    await prisma.maintenanceBlock.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
  });

  // Arbitraries (generators)
  const futureDate = () =>
    fc.date({ min: new Date('2025-01-20'), max: new Date('2025-12-31') });

  const hourArbitrary = () => fc.integer({ min: 8, max: 20 });

  const durationHoursArbitrary = () => fc.integer({ min: 1, max: 4 });

  const reasonArbitrary = () =>
    fc.oneof(
      fc.constant('Scheduled maintenance'),
      fc.constant('Cleaning'),
      fc.constant('Repairs'),
      fc.constant('Equipment upgrade'),
      fc.constant(undefined)
    );

  // Feature: breakout-room-booking, Property 27: Maintenance blocks have required fields
  // **Validates: Requirements 10.1**
  describe('Property 27: Maintenance blocks have required fields', () => {
    it('should create maintenance blocks with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          futureDate(),
          hourArbitrary(),
          durationHoursArbitrary(),
          reasonArbitrary(),
          async (date, startHour, durationHours, reason) => {
            // Validate date is not invalid
            if (isNaN(date.getTime())) {
              return; // Skip invalid dates
            }

            // Create a test room
            const room = await roomService.createRoom({
              name: `Test Room ${Date.now()}-${Math.random()}`,
              capacity: 10,
              equipment: [],
              status: 'active' as RoomStatus,
            });

            // Create maintenance block
            const startAt = new Date(date);
            startAt.setUTCHours(startHour, 0, 0, 0);
            const endAt = new Date(startAt);
            endAt.setUTCHours(startHour + durationHours, 0, 0, 0);

            const blockData = {
              roomId: room.id,
              startAt,
              endAt,
              reason,
            };

            const block = await maintenanceBlockService.createMaintenanceBlock(blockData);

            // Verify all required fields are present
            expect(block.id).toBeDefined();
            expect(typeof block.id).toBe('string');
            expect(block.roomId).toBe(room.id);
            expect(typeof block.roomId).toBe('string');
            expect(block.startAt).toBeDefined();
            expect(block.startAt instanceof Date).toBe(true);
            expect(block.endAt).toBeDefined();
            expect(block.endAt instanceof Date).toBe(true);
            expect(block.startAt.getTime()).toBeLessThan(block.endAt.getTime());
            // Reason can be null or string
            expect(block.reason === null || typeof block.reason === 'string').toBe(true);
            expect(block.createdAt).toBeDefined();
            expect(block.updatedAt).toBeDefined();

            // Clean up - delete maintenance block first, then room
            await prisma.maintenanceBlock.delete({ where: { id: block.id } });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // Feature: breakout-room-booking, Property 29: Removing maintenance blocks frees up time slots
  // **Validates: Requirements 10.5**
  describe('Property 29: Removing maintenance blocks frees up time slots', () => {
    it('should make room available after removing maintenance block', async () => {
      await fc.assert(
        fc.asyncProperty(
          futureDate(),
          hourArbitrary(),
          durationHoursArbitrary(),
          async (date, startHour, durationHours) => {
            // Validate date is not invalid
            if (isNaN(date.getTime())) {
              return; // Skip invalid dates
            }

            // Create a test room
            const room = await roomService.createRoom({
              name: `Test Room ${Date.now()}-${Math.random()}`,
              capacity: 10,
              equipment: [],
              status: 'active' as RoomStatus,
            });

            // Create maintenance block
            const startAt = new Date(date);
            startAt.setUTCHours(startHour, 0, 0, 0);
            const endAt = new Date(startAt);
            endAt.setUTCHours(startHour + durationHours, 0, 0, 0);

            const block = await maintenanceBlockService.createMaintenanceBlock({
              roomId: room.id,
              startAt,
              endAt,
              reason: 'Test maintenance',
            });

            // Search for rooms during maintenance time - should be marked as maintenance
            const resultsBeforeDelete = await roomService.searchRooms({
              date,
              startTime: `${String(startHour).padStart(2, '0')}:00`,
              endTime: `${String(startHour + durationHours).padStart(2, '0')}:00`,
            });

            const roomBeforeDelete = resultsBeforeDelete.find((r) => r.id === room.id);
            expect(roomBeforeDelete?.availabilityStatus).toBe('maintenance');

            // Delete the maintenance block
            await maintenanceBlockService.deleteMaintenanceBlock(block.id);

            // Search again - room should now be available
            const resultsAfterDelete = await roomService.searchRooms({
              date,
              startTime: `${String(startHour).padStart(2, '0')}:00`,
              endTime: `${String(startHour + durationHours).padStart(2, '0')}:00`,
            });

            const roomAfterDelete = resultsAfterDelete.find((r) => r.id === room.id);
            expect(roomAfterDelete?.availabilityStatus).toBe('available');

            // Clean up - room will be deleted by afterEach
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow bookings after removing maintenance block', async () => {
      await fc.assert(
        fc.asyncProperty(
          futureDate(),
          hourArbitrary(),
          durationHoursArbitrary(),
          async (date, startHour, durationHours) => {
            // Validate date is not invalid
            if (isNaN(date.getTime())) {
              return; // Skip invalid dates
            }

            // Create a test room
            const room = await roomService.createRoom({
              name: `Test Room ${Date.now()}-${Math.random()}`,
              capacity: 10,
              equipment: [],
              status: 'active' as RoomStatus,
            });

            // Create a test user
            const user = await prisma.user.create({
              data: {
                email: `test-${Date.now()}-${Math.random()}@example.com`,
                passwordHash: 'hash',
                role: 'user',
              },
            });

            // Create maintenance block
            const startAt = new Date(date);
            startAt.setUTCHours(startHour, 0, 0, 0);
            const endAt = new Date(startAt);
            endAt.setUTCHours(startHour + durationHours, 0, 0, 0);

            const block = await maintenanceBlockService.createMaintenanceBlock({
              roomId: room.id,
              startAt,
              endAt,
              reason: 'Test maintenance',
            });

            // Verify maintenance block exists
            const blocksBefore = await maintenanceBlockService.getMaintenanceBlocks({
              roomId: room.id,
            });
            expect(blocksBefore.length).toBe(1);

            // Delete the maintenance block
            await maintenanceBlockService.deleteMaintenanceBlock(block.id);

            // Verify maintenance block is deleted
            const blocksAfter = await maintenanceBlockService.getMaintenanceBlocks({
              roomId: room.id,
            });
            expect(blocksAfter.length).toBe(0);

            // Now we should be able to create a booking for that time slot
            const booking = await prisma.booking.create({
              data: {
                userId: user.id,
                roomId: room.id,
                startAt,
                endAt,
                status: 'confirmed',
              },
            });

            expect(booking).toBeDefined();
            expect(booking.roomId).toBe(room.id);

            // Clean up - booking and user will be deleted by afterEach, room cascade deletes maintenance blocks
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
