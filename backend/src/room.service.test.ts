import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomService } from './room.service';
import prisma from './db';
import { RoomStatus } from '@prisma/client';

describe('RoomService', () => {
  let roomService: RoomService;

  beforeEach(() => {
    roomService = new RoomService();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({});
    await prisma.maintenanceBlock.deleteMany({});
    await prisma.room.deleteMany({});
  });

  describe('createRoom', () => {
    it('should create a room with valid data', async () => {
      const roomData = {
        name: 'Conference Room A',
        capacity: 10,
        equipment: ['projector', 'whiteboard'],
        status: 'active' as RoomStatus,
      };

      const room = await roomService.createRoom(roomData);

      expect(room).toBeDefined();
      expect(room.id).toBeDefined();
      expect(room.name).toBe(roomData.name);
      expect(room.capacity).toBe(roomData.capacity);
      expect(room.equipment).toEqual(roomData.equipment);
      expect(room.status).toBe(roomData.status);
    });

    it('should reject duplicate room names', async () => {
      const roomData = {
        name: 'Conference Room B',
        capacity: 8,
        equipment: ['projector'],
        status: 'active' as RoomStatus,
      };

      await roomService.createRoom(roomData);

      await expect(roomService.createRoom(roomData)).rejects.toThrow(
        'Room name already exists'
      );
    });

    it('should create room with empty equipment array', async () => {
      const roomData = {
        name: 'Simple Room',
        capacity: 5,
        equipment: [],
        status: 'active' as RoomStatus,
      };

      const room = await roomService.createRoom(roomData);

      expect(room.equipment).toEqual([]);
    });
  });

  describe('updateRoom', () => {
    it('should update room with valid data', async () => {
      const room = await roomService.createRoom({
        name: 'Original Name',
        capacity: 10,
        equipment: ['projector'],
        status: 'active' as RoomStatus,
      });

      const updatedRoom = await roomService.updateRoom(room.id, {
        name: 'Updated Name',
        capacity: 15,
      });

      expect(updatedRoom.name).toBe('Updated Name');
      expect(updatedRoom.capacity).toBe(15);
      expect(updatedRoom.equipment).toEqual(['projector']);
    });

    it('should update room status', async () => {
      const room = await roomService.createRoom({
        name: 'Test Room',
        capacity: 10,
        equipment: [],
        status: 'active' as RoomStatus,
      });

      const updatedRoom = await roomService.updateRoom(room.id, {
        status: 'maintenance' as RoomStatus,
      });

      expect(updatedRoom.status).toBe('maintenance');
    });

    it('should reject update with duplicate name', async () => {
      const room1 = await roomService.createRoom({
        name: 'Room 1',
        capacity: 10,
        equipment: [],
        status: 'active' as RoomStatus,
      });

      const room2 = await roomService.createRoom({
        name: 'Room 2',
        capacity: 10,
        equipment: [],
        status: 'active' as RoomStatus,
      });

      await expect(
        roomService.updateRoom(room2.id, { name: 'Room 1' })
      ).rejects.toThrow('Room name already exists');
    });

    it('should reject update for non-existent room', async () => {
      await expect(
        roomService.updateRoom('non-existent-id', { capacity: 20 })
      ).rejects.toThrow('Room not found');
    });
  });

  describe('archiveRoom', () => {
    it('should archive a room', async () => {
      const room = await roomService.createRoom({
        name: 'Room to Archive',
        capacity: 10,
        equipment: [],
        status: 'active' as RoomStatus,
      });

      const archivedRoom = await roomService.archiveRoom(room.id);

      expect(archivedRoom.status).toBe('archived');
    });

    it('should reject archiving non-existent room', async () => {
      await expect(
        roomService.archiveRoom('non-existent-id')
      ).rejects.toThrow('Room not found');
    });
  });

  describe('getRoomById', () => {
    it('should return room by id', async () => {
      const createdRoom = await roomService.createRoom({
        name: 'Test Room',
        capacity: 10,
        equipment: ['projector'],
        status: 'active' as RoomStatus,
      });

      const room = await roomService.getRoomById(createdRoom.id);

      expect(room).toBeDefined();
      expect(room?.id).toBe(createdRoom.id);
      expect(room?.name).toBe('Test Room');
    });

    it('should return null for non-existent room', async () => {
      const room = await roomService.getRoomById('non-existent-id');
      expect(room).toBeNull();
    });
  });

  describe('searchRooms', () => {
    it('should return rooms matching capacity filter', async () => {
      await roomService.createRoom({
        name: 'Small Room',
        capacity: 5,
        equipment: [],
        status: 'active' as RoomStatus,
      });

      await roomService.createRoom({
        name: 'Large Room',
        capacity: 20,
        equipment: [],
        status: 'active' as RoomStatus,
      });

      const results = await roomService.searchRooms({
        date: new Date('2025-01-20'),
        startTime: '10:00',
        endTime: '11:00',
        minCapacity: 10,
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Large Room');
    });

    it('should return rooms matching equipment filter', async () => {
      await roomService.createRoom({
        name: 'Room with Projector',
        capacity: 10,
        equipment: ['projector', 'whiteboard'],
        status: 'active' as RoomStatus,
      });

      await roomService.createRoom({
        name: 'Room without Projector',
        capacity: 10,
        equipment: ['whiteboard'],
        status: 'active' as RoomStatus,
      });

      const results = await roomService.searchRooms({
        date: new Date('2025-01-20'),
        startTime: '10:00',
        endTime: '11:00',
        equipmentTags: ['projector'],
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Room with Projector');
    });

    it('should mark room as unavailable when booked', async () => {
      const room = await roomService.createRoom({
        name: 'Bookable Room',
        capacity: 10,
        equipment: [],
        status: 'active' as RoomStatus,
      });

      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hash',
          role: 'user',
        },
      });

      // Create a booking
      await prisma.booking.create({
        data: {
          userId: user.id,
          roomId: room.id,
          startAt: new Date('2025-01-20T10:00:00Z'),
          endAt: new Date('2025-01-20T11:00:00Z'),
          status: 'confirmed',
        },
      });

      const results = await roomService.searchRooms({
        date: new Date('2025-01-20'),
        startTime: '10:00',
        endTime: '11:00',
      });

      const bookedRoom = results.find((r) => r.id === room.id);
      expect(bookedRoom?.availabilityStatus).toBe('unavailable');
    });

    it('should mark room as maintenance when maintenance block exists', async () => {
      const room = await roomService.createRoom({
        name: 'Room Under Maintenance',
        capacity: 10,
        equipment: [],
        status: 'active' as RoomStatus,
      });

      // Create a maintenance block
      await prisma.maintenanceBlock.create({
        data: {
          roomId: room.id,
          startAt: new Date('2025-01-20T10:00:00Z'),
          endAt: new Date('2025-01-20T11:00:00Z'),
          reason: 'Scheduled maintenance',
        },
      });

      const results = await roomService.searchRooms({
        date: new Date('2025-01-20'),
        startTime: '10:00',
        endTime: '11:00',
      });

      const maintenanceRoom = results.find((r) => r.id === room.id);
      expect(maintenanceRoom?.availabilityStatus).toBe('maintenance');
    });

    it('should mark room with maintenance status as maintenance', async () => {
      await roomService.createRoom({
        name: 'Maintenance Status Room',
        capacity: 10,
        equipment: [],
        status: 'maintenance' as RoomStatus,
      });

      const results = await roomService.searchRooms({
        date: new Date('2025-01-20'),
        startTime: '10:00',
        endTime: '11:00',
      });

      expect(results[0].availabilityStatus).toBe('maintenance');
    });

    it('should mark archived room as unavailable', async () => {
      await roomService.createRoom({
        name: 'Archived Room',
        capacity: 10,
        equipment: [],
        status: 'archived' as RoomStatus,
      });

      const results = await roomService.searchRooms({
        date: new Date('2025-01-20'),
        startTime: '10:00',
        endTime: '11:00',
      });

      expect(results[0].availabilityStatus).toBe('unavailable');
    });

    it('should return available room when no conflicts', async () => {
      await roomService.createRoom({
        name: 'Available Room',
        capacity: 10,
        equipment: [],
        status: 'active' as RoomStatus,
      });

      const results = await roomService.searchRooms({
        date: new Date('2025-01-20'),
        startTime: '10:00',
        endTime: '11:00',
      });

      expect(results[0].availabilityStatus).toBe('available');
    });
  });
});
