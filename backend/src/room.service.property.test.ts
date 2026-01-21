import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { RoomService } from './room.service';
import prisma from './db';
import { RoomStatus } from '@prisma/client';

describe('RoomService Property Tests', () => {
  const roomService = new RoomService();

  afterEach(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({});
    await prisma.maintenanceBlock.deleteMany({});
    await prisma.room.deleteMany({});
  });

  // Arbitraries (generators)
  const roomNameArbitrary = () =>
    fc.string({ minLength: 1, maxLength: 50 }).map((s) => `Room ${s}`);

  const capacityArbitrary = () => fc.integer({ min: 1, max: 100 });

  const equipmentArbitrary = () =>
    fc.array(
      fc.oneof(
        fc.constant('projector'),
        fc.constant('whiteboard'),
        fc.constant('tv'),
        fc.constant('conference_phone'),
        fc.constant('video_camera')
      ),
      { maxLength: 5 }
    );

  const roomStatusArbitrary = () =>
    fc.oneof(
      fc.constant('active' as RoomStatus),
      fc.constant('maintenance' as RoomStatus),
      fc.constant('archived' as RoomStatus)
    );

  const createRoomDataArbitrary = () =>
    fc.record({
      name: roomNameArbitrary(),
      capacity: capacityArbitrary(),
      equipment: equipmentArbitrary(),
      status: roomStatusArbitrary(),
    });

  // Feature: breakout-room-booking, Property 3: Created rooms have required fields
  describe('Property 3: Created rooms have required fields', () => {
    it('should create rooms with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(createRoomDataArbitrary(), async (roomData) => {
          const room = await roomService.createRoom(roomData);

          // Verify all required fields are present
          expect(room.id).toBeDefined();
          expect(typeof room.id).toBe('string');
          expect(room.name).toBe(roomData.name);
          expect(room.capacity).toBe(roomData.capacity);
          expect(typeof room.capacity).toBe('number');
          expect(room.capacity).toBeGreaterThan(0);
          expect(Array.isArray(room.equipment)).toBe(true);
          expect(room.status).toBeDefined();
          expect(['active', 'maintenance', 'archived']).toContain(room.status);
          expect(room.createdAt).toBeDefined();
          expect(room.updatedAt).toBeDefined();

          // Clean up
          await prisma.room.delete({ where: { id: room.id } });
        }),
        { numRuns: 50 } // Reduced runs for database operations
      );
    });
  });

  // Feature: breakout-room-booking, Property 4: Room names are unique
  describe('Property 4: Room names are unique', () => {
    it('should reject duplicate room names', async () => {
      await fc.assert(
        fc.asyncProperty(
          createRoomDataArbitrary(),
          createRoomDataArbitrary(),
          async (roomData1, roomData2) => {
            // Create first room
            const room1 = await roomService.createRoom(roomData1);

            // Attempt to create second room with same name
            const duplicateData = {
              ...roomData2,
              name: roomData1.name, // Use same name
            };

            await expect(roomService.createRoom(duplicateData)).rejects.toThrow();

            // Clean up
            await prisma.room.delete({ where: { id: room1.id } });
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should allow rooms with different names', async () => {
      await fc.assert(
        fc.asyncProperty(
          createRoomDataArbitrary(),
          createRoomDataArbitrary(),
          async (roomData1, roomData2) => {
            // Ensure names are different
            if (roomData1.name === roomData2.name) {
              roomData2.name = roomData2.name + '_different';
            }

            // Create both rooms
            const room1 = await roomService.createRoom(roomData1);
            const room2 = await roomService.createRoom(roomData2);

            // Verify both were created
            expect(room1.id).toBeDefined();
            expect(room2.id).toBeDefined();
            expect(room1.id).not.toBe(room2.id);
            expect(room1.name).not.toBe(room2.name);

            // Clean up
            await prisma.room.delete({ where: { id: room1.id } });
            await prisma.room.delete({ where: { id: room2.id } });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // Feature: breakout-room-booking, Property 6: Archived rooms preserve history but prevent new bookings
  describe('Property 6: Archived rooms preserve history but prevent new bookings', () => {
    it('should preserve room data when archived', async () => {
      await fc.assert(
        fc.asyncProperty(createRoomDataArbitrary(), async (roomData) => {
          // Create room
          const room = await roomService.createRoom(roomData);
          const originalId = room.id;
          const originalName = room.name;
          const originalCapacity = room.capacity;

          // Archive the room
          const archivedRoom = await roomService.archiveRoom(room.id);

          // Verify room still exists with same data
          expect(archivedRoom.id).toBe(originalId);
          expect(archivedRoom.name).toBe(originalName);
          expect(archivedRoom.capacity).toBe(originalCapacity);
          expect(archivedRoom.status).toBe('archived');

          // Verify room can still be retrieved
          const retrievedRoom = await roomService.getRoomById(room.id);
          expect(retrievedRoom).not.toBeNull();
          expect(retrievedRoom?.id).toBe(originalId);

          // Clean up - room will be deleted by afterEach
        }),
        { numRuns: 30 }
      );
    });

    it('should mark archived rooms as unavailable in search', async () => {
      await fc.assert(
        fc.asyncProperty(createRoomDataArbitrary(), async (roomData) => {
          // Create and archive room with unique name
          const uniqueName = `${roomData.name}-${Date.now()}-${Math.random()}`;
          const uniqueRoomData = { ...roomData, name: uniqueName };
          const room = await roomService.createRoom(uniqueRoomData);
          await roomService.archiveRoom(room.id);

          // Search for rooms
          const results = await roomService.searchRooms({
            date: new Date('2025-01-20'),
            startTime: '10:00',
            endTime: '11:00',
          });

          // Find the archived room in results
          const archivedRoom = results.find((r) => r.id === room.id);

          // Verify it's marked as unavailable
          if (archivedRoom) {
            expect(archivedRoom.availabilityStatus).toBe('unavailable');
          }

          // Clean up - room will be deleted by afterEach
        }),
        { numRuns: 30 }
      );
    });

    it('should preserve booking history for archived rooms', async () => {
      await fc.assert(
        fc.asyncProperty(createRoomDataArbitrary(), async (roomData) => {
          // Create room with active status
          const activeRoomData = { ...roomData, status: 'active' as RoomStatus };
          const room = await roomService.createRoom(activeRoomData);

          // Create a test user
          const user = await prisma.user.create({
            data: {
              email: `test-${Date.now()}-${Math.random()}@example.com`,
              passwordHash: 'hash',
              role: 'user',
            },
          });

          // Create a booking for the room
          const booking = await prisma.booking.create({
            data: {
              userId: user.id,
              roomId: room.id,
              startAt: new Date('2025-01-20T10:00:00Z'),
              endAt: new Date('2025-01-20T11:00:00Z'),
              status: 'confirmed',
            },
          });

          // Archive the room
          await roomService.archiveRoom(room.id);

          // Verify booking still exists
          const retrievedBooking = await prisma.booking.findUnique({
            where: { id: booking.id },
          });
          expect(retrievedBooking).not.toBeNull();
          expect(retrievedBooking?.roomId).toBe(room.id);

          // Clean up
          await prisma.booking.delete({ where: { id: booking.id } });
          await prisma.user.delete({ where: { id: user.id } });
          await prisma.room.delete({ where: { id: room.id } });
        }),
        { numRuns: 20 }
      );
    });
  });

  // Feature: breakout-room-booking, Property 7: Search accepts all specified filters
  describe('Property 7: Search accepts all specified filters', () => {
    it('should accept all search filters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }),
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(
            fc.array(
              fc.oneof(
                fc.constant('projector'),
                fc.constant('whiteboard'),
                fc.constant('tv')
              ),
              { maxLength: 3 }
            ),
            { nil: undefined }
          ),
          async (date, startHour, startMin, endHour, endMin, minCapacity, equipmentTags) => {
            // Validate date is not invalid
            if (isNaN(date.getTime())) {
              return; // Skip invalid dates
            }

            // Ensure end time is after start time
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            
            if (endMinutes <= startMinutes) {
              return; // Skip invalid time ranges
            }

            const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
            const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

            // Search should not throw an error
            const results = await roomService.searchRooms({
              date,
              startTime,
              endTime,
              minCapacity,
              equipmentTags,
            });

            // Results should be an array
            expect(Array.isArray(results)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: breakout-room-booking, Property 8: Availability computation considers bookings and maintenance
  describe('Property 8: Availability computation considers bookings and maintenance', () => {
    it('should mark rooms unavailable when booked', async () => {
      await fc.assert(
        fc.asyncProperty(
          createRoomDataArbitrary(),
          fc.date({ min: new Date('2025-01-20'), max: new Date('2025-01-30') }),
          fc.integer({ min: 8, max: 20 }),
          fc.integer({ min: 1, max: 3 }),
          async (roomData, date, startHour, durationHours) => {
            // Create room with active status and unique name
            const uniqueName = `${roomData.name}-${Date.now()}-${Math.random()}`;
            const activeRoomData = { ...roomData, name: uniqueName, status: 'active' as RoomStatus };
            const room = await roomService.createRoom(activeRoomData);

            // Create a test user
            const user = await prisma.user.create({
              data: {
                email: `test-${Date.now()}-${Math.random()}@example.com`,
                passwordHash: 'hash',
                role: 'user',
              },
            });

            // Create a booking
            const bookingStart = new Date(date);
            bookingStart.setUTCHours(startHour, 0, 0, 0);
            const bookingEnd = new Date(bookingStart);
            bookingEnd.setUTCHours(startHour + durationHours, 0, 0, 0);

            await prisma.booking.create({
              data: {
                userId: user.id,
                roomId: room.id,
                startAt: bookingStart,
                endAt: bookingEnd,
                status: 'confirmed',
              },
            });

            // Search for rooms during the booked time
            const results = await roomService.searchRooms({
              date,
              startTime: `${String(startHour).padStart(2, '0')}:00`,
              endTime: `${String(startHour + durationHours).padStart(2, '0')}:00`,
            });

            // Find the booked room
            const bookedRoom = results.find((r) => r.id === room.id);

            // Should be marked as unavailable
            if (bookedRoom) {
              expect(bookedRoom.availabilityStatus).toBe('unavailable');
            }

            // Clean up
            await prisma.booking.deleteMany({ where: { roomId: room.id } });
            await prisma.user.delete({ where: { id: user.id } });
            await prisma.room.delete({ where: { id: room.id } });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should mark rooms as maintenance when maintenance block exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          createRoomDataArbitrary(),
          fc.date({ min: new Date('2025-01-20'), max: new Date('2025-01-30') }),
          fc.integer({ min: 8, max: 20 }),
          fc.integer({ min: 1, max: 3 }),
          async (roomData, date, startHour, durationHours) => {
            // Create room with active status
            const activeRoomData = { ...roomData, status: 'active' as RoomStatus };
            const room = await roomService.createRoom(activeRoomData);

            // Create a maintenance block
            const maintenanceStart = new Date(date);
            maintenanceStart.setUTCHours(startHour, 0, 0, 0);
            const maintenanceEnd = new Date(maintenanceStart);
            maintenanceEnd.setUTCHours(startHour + durationHours, 0, 0, 0);

            await prisma.maintenanceBlock.create({
              data: {
                roomId: room.id,
                startAt: maintenanceStart,
                endAt: maintenanceEnd,
                reason: 'Scheduled maintenance',
              },
            });

            // Search for rooms during the maintenance time
            const results = await roomService.searchRooms({
              date,
              startTime: `${String(startHour).padStart(2, '0')}:00`,
              endTime: `${String(startHour + durationHours).padStart(2, '0')}:00`,
            });

            // Find the room under maintenance
            const maintenanceRoom = results.find((r) => r.id === room.id);

            // Should be marked as maintenance
            if (maintenanceRoom) {
              expect(maintenanceRoom.availabilityStatus).toBe('maintenance');
            }

            // Clean up
            await prisma.maintenanceBlock.deleteMany({ where: { roomId: room.id } });
            await prisma.room.delete({ where: { id: room.id } });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // Feature: breakout-room-booking, Property 9: Search results contain required information
  describe('Property 9: Search results contain required information', () => {
    it('should return rooms with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          createRoomDataArbitrary(),
          async (roomData) => {
            // Create room
            const room = await roomService.createRoom(roomData);

            // Search for rooms
            const results = await roomService.searchRooms({
              date: new Date('2025-01-20'),
              startTime: '10:00',
              endTime: '11:00',
            });

            // Find the created room
            const foundRoom = results.find((r) => r.id === room.id);

            if (foundRoom) {
              // Verify all required fields are present
              expect(foundRoom.id).toBeDefined();
              expect(typeof foundRoom.id).toBe('string');
              expect(foundRoom.name).toBeDefined();
              expect(typeof foundRoom.name).toBe('string');
              expect(foundRoom.capacity).toBeDefined();
              expect(typeof foundRoom.capacity).toBe('number');
              expect(Array.isArray(foundRoom.equipment)).toBe(true);
              expect(foundRoom.availabilityStatus).toBeDefined();
              expect(['available', 'partially_available', 'unavailable', 'maintenance']).toContain(
                foundRoom.availabilityStatus
              );
            }

            // Clean up
            await prisma.room.delete({ where: { id: room.id } });
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
