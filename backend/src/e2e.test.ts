import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { BookingService } from './booking.service';
import { RoomService } from './room.service';
import { RuleService } from './rule.service';
import { MaintenanceBlockService } from './maintenance.service';

const prisma = new PrismaClient();
const ruleService = new RuleService();
const roomService = new RoomService();
const bookingService = new BookingService(ruleService, roomService);
const maintenanceService = new MaintenanceBlockService(prisma);

describe('End-to-End Critical Path Tests', () => {
  let testUserId: string;
  let testRoomId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: `e2e-user-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'user',
      },
    });
    testUserId = testUser.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: `e2e-admin-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'admin',
      },
    });
    adminUserId = adminUser.id;

    // Create test room
    const testRoom = await roomService.createRoom({
      name: `E2E Test Room ${Date.now()}`,
      capacity: 10,
      equipment: ['Projector', 'Whiteboard'],
      status: 'active',
    });
    testRoomId = testRoom.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    await prisma.booking.deleteMany({
      where: { userId: { in: [testUserId, adminUserId] } },
    });
    await prisma.room.deleteMany({
      where: { id: testRoomId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, adminUserId] } },
    });
    await prisma.$disconnect();
  });

  describe('Complete Booking Flow (search → book → cancel)', () => {
    it('should complete full booking lifecycle', async () => {
      // Step 1: Search for available rooms
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(10, 0, 0, 0); // Use UTC time

      const endTime = new Date(tomorrow);
      endTime.setUTCHours(11, 0, 0, 0); // Use UTC time

      const searchResults = await roomService.searchRooms({
        date: tomorrow.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        minCapacity: 5,
      });

      // Verify room is in search results
      const foundRoom = searchResults.find((r) => r.id === testRoomId);
      expect(foundRoom).toBeDefined();
      expect(foundRoom?.availabilityStatus).toBe('available');

      // Step 2: Create a booking
      const booking = await bookingService.createBooking(
        testUserId,
        testRoomId,
        tomorrow,
        endTime
      );

      expect(booking).toBeDefined();
      expect(booking.status).toBe('confirmed');
      expect(booking.userId).toBe(testUserId);
      expect(booking.roomId).toBe(testRoomId);

      // Step 3: Verify booking appears in user's bookings
      const userBookings = await bookingService.getUserBookings(testUserId);
      const createdBooking = userBookings.find((b) => b.id === booking.id);
      expect(createdBooking).toBeDefined();
      expect(createdBooking?.status).toBe('confirmed');

      // Step 4: Verify room is no longer available for same time slot
      const searchAfterBooking = await roomService.searchRooms({
        date: tomorrow.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        minCapacity: 5,
      });

      const roomAfterBooking = searchAfterBooking.find((r) => r.id === testRoomId);
      expect(roomAfterBooking?.availabilityStatus).toBe('unavailable');

      // Step 5: Cancel the booking
      await bookingService.cancelBooking(booking.id, testUserId, false);

      // Step 6: Verify booking is cancelled
      const cancelledBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(cancelledBooking?.status).toBe('cancelled');
      expect(cancelledBooking?.cancelledBy).toBe(testUserId);

      // Step 7: Verify room is available again
      const searchAfterCancel = await roomService.searchRooms({
        date: tomorrow.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        minCapacity: 5,
      });

      const roomAfterCancel = searchAfterCancel.find((r) => r.id === testRoomId);
      expect(roomAfterCancel?.availabilityStatus).toBe('available');
    });
  });

  describe('Admin Flow (create room → create maintenance → update rules)', () => {
    it('should complete full admin workflow', async () => {
      // Step 1: Admin creates a new room
      const newRoom = await roomService.createRoom({
        name: `Admin Created Room ${Date.now()}`,
        capacity: 15,
        equipment: ['TV', 'Conference Phone'],
        status: 'active',
      });

      expect(newRoom).toBeDefined();
      expect(newRoom.name).toContain('Admin Created Room');
      expect(newRoom.capacity).toBe(15);

      // Step 2: Admin creates a maintenance block
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(14, 0, 0, 0); // Use UTC time

      const maintenanceEnd = new Date(tomorrow);
      maintenanceEnd.setUTCHours(16, 0, 0, 0); // Use UTC time

      const maintenanceBlock = await maintenanceService.createMaintenanceBlock({
        roomId: newRoom.id,
        startAt: tomorrow,
        endAt: maintenanceEnd,
        reason: 'Scheduled maintenance',
      });

      expect(maintenanceBlock).toBeDefined();
      expect(maintenanceBlock.roomId).toBe(newRoom.id);

      // Step 3: Verify room is unavailable during maintenance
      const searchDuringMaintenance = await roomService.searchRooms({
        date: tomorrow.toISOString().split('T')[0],
        startTime: '14:00',
        endTime: '15:00',
        minCapacity: 10,
      });

      const roomDuringMaintenance = searchDuringMaintenance.find((r) => r.id === newRoom.id);
      expect(roomDuringMaintenance?.availabilityStatus).toBe('maintenance');

      // Step 4: Admin updates booking rules
      const currentRules = await ruleService.getRules();
      const originalMaxActive = currentRules.maxActiveBookings;

      const updatedRules = await ruleService.updateRules({
        maxActiveBookings: originalMaxActive + 1,
      });

      expect(updatedRules.maxActiveBookings).toBe(originalMaxActive + 1);

      // Step 5: Restore original rules
      await ruleService.updateRules({
        maxActiveBookings: originalMaxActive,
      });

      // Step 6: Delete maintenance block
      await maintenanceService.deleteMaintenanceBlock(maintenanceBlock.id);

      // Step 7: Verify room is available after maintenance removal
      const searchAfterMaintenance = await roomService.searchRooms({
        date: tomorrow.toISOString().split('T')[0],
        startTime: '14:00',
        endTime: '15:00',
        minCapacity: 10,
      });

      const roomAfterMaintenance = searchAfterMaintenance.find((r) => r.id === newRoom.id);
      expect(roomAfterMaintenance?.availabilityStatus).toBe('available');

      // Cleanup: Archive the room
      await roomService.archiveRoom(newRoom.id);
    });
  });

  describe('Concurrent Booking Prevention', () => {
    it('should prevent double-booking under concurrent requests', async () => {
      // Create a time slot for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      tomorrow.setUTCHours(13, 0, 0, 0); // Use UTC time

      const endTime = new Date(tomorrow);
      endTime.setUTCHours(14, 0, 0, 0); // Use UTC time

      // Create two users
      const user1 = await prisma.user.create({
        data: {
          email: `concurrent-user1-${Date.now()}@test.com`,
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'user',
        },
      });

      const user2 = await prisma.user.create({
        data: {
          email: `concurrent-user2-${Date.now()}@test.com`,
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'user',
        },
      });

      // Attempt concurrent bookings
      const results = await Promise.allSettled([
        bookingService.createBooking(user1.id, testRoomId, tomorrow, endTime),
        bookingService.createBooking(user2.id, testRoomId, tomorrow, endTime),
      ]);

      // Exactly one should succeed and one should fail
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Verify only one booking exists
      const bookings = await prisma.booking.findMany({
        where: {
          roomId: testRoomId,
          startAt: tomorrow,
          endAt: endTime,
          status: 'confirmed',
        },
      });

      expect(bookings.length).toBe(1);

      // Cleanup
      await prisma.booking.deleteMany({
        where: { userId: { in: [user1.id, user2.id] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [user1.id, user2.id] } },
      });
    });
  });

  describe('Cross-Service Integration', () => {
    it('should maintain consistency across all services', async () => {
      // This test verifies that changes in one service are properly reflected in others
      
      // Step 1: Create a booking
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      tomorrow.setUTCHours(9, 0, 0, 0); // Use UTC time

      const endTime = new Date(tomorrow);
      endTime.setUTCHours(10, 0, 0, 0); // Use UTC time

      const booking = await bookingService.createBooking(
        testUserId,
        testRoomId,
        tomorrow,
        endTime
      );

      // Step 2: Verify room service reflects the booking
      const roomAvailability = await roomService.searchRooms({
        date: tomorrow.toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
      });

      const room = roomAvailability.find((r) => r.id === testRoomId);
      expect(room?.availabilityStatus).toBe('unavailable');

      // Step 3: Cancel booking
      await bookingService.cancelBooking(booking.id, testUserId, false);

      // Step 4: Verify room service reflects the cancellation
      const roomAfterCancel = await roomService.searchRooms({
        date: tomorrow.toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
      });

      const roomUpdated = roomAfterCancel.find((r) => r.id === testRoomId);
      expect(roomUpdated?.availabilityStatus).toBe('available');
    });
  });
});
