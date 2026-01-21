import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MaintenanceBlockService } from './maintenance.service';
import prisma from './db';
import { RoomStatus } from '@prisma/client';

describe('MaintenanceBlockService', () => {
  let maintenanceBlockService: MaintenanceBlockService;
  let testRoomId: string;

  beforeEach(async () => {
    maintenanceBlockService = new MaintenanceBlockService();

    // Create a test room
    const room = await prisma.room.create({
      data: {
        name: `Test Room ${Date.now()}`,
        capacity: 10,
        equipment: [],
        status: 'active' as RoomStatus,
      },
    });
    testRoomId = room.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.maintenanceBlock.deleteMany({});
    await prisma.room.deleteMany({});
  });

  describe('createMaintenanceBlock', () => {
    it('should create a maintenance block with valid data', async () => {
      const blockData = {
        roomId: testRoomId,
        startAt: new Date('2025-01-20T10:00:00Z'),
        endAt: new Date('2025-01-20T12:00:00Z'),
        reason: 'Scheduled maintenance',
      };

      const block = await maintenanceBlockService.createMaintenanceBlock(blockData);

      expect(block).toBeDefined();
      expect(block.id).toBeDefined();
      expect(block.roomId).toBe(testRoomId);
      expect(block.startAt).toEqual(blockData.startAt);
      expect(block.endAt).toEqual(blockData.endAt);
      expect(block.reason).toBe(blockData.reason);
    });

    it('should create a maintenance block without reason', async () => {
      const blockData = {
        roomId: testRoomId,
        startAt: new Date('2025-01-20T10:00:00Z'),
        endAt: new Date('2025-01-20T12:00:00Z'),
      };

      const block = await maintenanceBlockService.createMaintenanceBlock(blockData);

      expect(block).toBeDefined();
      expect(block.reason).toBeNull();
    });

    it('should reject maintenance block with invalid time range', async () => {
      const blockData = {
        roomId: testRoomId,
        startAt: new Date('2025-01-20T12:00:00Z'),
        endAt: new Date('2025-01-20T10:00:00Z'), // End before start
      };

      await expect(
        maintenanceBlockService.createMaintenanceBlock(blockData)
      ).rejects.toThrow('Start time must be before end time');
    });

    it('should reject maintenance block for non-existent room', async () => {
      const blockData = {
        roomId: 'non-existent-room-id',
        startAt: new Date('2025-01-20T10:00:00Z'),
        endAt: new Date('2025-01-20T12:00:00Z'),
      };

      await expect(
        maintenanceBlockService.createMaintenanceBlock(blockData)
      ).rejects.toThrow('Room not found');
    });
  });

  describe('deleteMaintenanceBlock', () => {
    it('should delete an existing maintenance block', async () => {
      // Create a maintenance block
      const block = await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-20T10:00:00Z'),
        endAt: new Date('2025-01-20T12:00:00Z'),
      });

      // Delete it
      await maintenanceBlockService.deleteMaintenanceBlock(block.id);

      // Verify it's deleted
      const deletedBlock = await prisma.maintenanceBlock.findUnique({
        where: { id: block.id },
      });
      expect(deletedBlock).toBeNull();
    });

    it('should reject deleting non-existent maintenance block', async () => {
      await expect(
        maintenanceBlockService.deleteMaintenanceBlock('non-existent-id')
      ).rejects.toThrow('Maintenance block not found');
    });
  });

  describe('getMaintenanceBlocks', () => {
    it('should return all maintenance blocks when no filter provided', async () => {
      // Create multiple maintenance blocks
      await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-20T10:00:00Z'),
        endAt: new Date('2025-01-20T12:00:00Z'),
      });

      await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-21T10:00:00Z'),
        endAt: new Date('2025-01-21T12:00:00Z'),
      });

      const blocks = await maintenanceBlockService.getMaintenanceBlocks();

      expect(blocks.length).toBe(2);
    });

    it('should filter maintenance blocks by room ID', async () => {
      // Create another test room
      const room2 = await prisma.room.create({
        data: {
          name: `Test Room 2 ${Date.now()}`,
          capacity: 10,
          equipment: [],
          status: 'active' as RoomStatus,
        },
      });

      // Create maintenance blocks for both rooms
      await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-20T10:00:00Z'),
        endAt: new Date('2025-01-20T12:00:00Z'),
      });

      await maintenanceBlockService.createMaintenanceBlock({
        roomId: room2.id,
        startAt: new Date('2025-01-20T10:00:00Z'),
        endAt: new Date('2025-01-20T12:00:00Z'),
      });

      // Filter by first room
      const blocks = await maintenanceBlockService.getMaintenanceBlocks({
        roomId: testRoomId,
      });

      expect(blocks.length).toBe(1);
      expect(blocks[0].roomId).toBe(testRoomId);
    });

    it('should filter maintenance blocks by date range', async () => {
      // Create maintenance blocks on different dates
      await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-20T10:00:00Z'),
        endAt: new Date('2025-01-20T12:00:00Z'),
      });

      await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-25T10:00:00Z'),
        endAt: new Date('2025-01-25T12:00:00Z'),
      });

      await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-30T10:00:00Z'),
        endAt: new Date('2025-01-30T12:00:00Z'),
      });

      // Filter by date range
      const blocks = await maintenanceBlockService.getMaintenanceBlocks({
        startDate: new Date('2025-01-22T00:00:00Z'),
        endDate: new Date('2025-01-28T00:00:00Z'),
      });

      expect(blocks.length).toBe(1);
      expect(blocks[0].startAt).toEqual(new Date('2025-01-25T10:00:00Z'));
    });

    it('should return blocks ordered by start time', async () => {
      // Create maintenance blocks in random order
      await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-25T10:00:00Z'),
        endAt: new Date('2025-01-25T12:00:00Z'),
      });

      await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-20T10:00:00Z'),
        endAt: new Date('2025-01-20T12:00:00Z'),
      });

      await maintenanceBlockService.createMaintenanceBlock({
        roomId: testRoomId,
        startAt: new Date('2025-01-30T10:00:00Z'),
        endAt: new Date('2025-01-30T12:00:00Z'),
      });

      const blocks = await maintenanceBlockService.getMaintenanceBlocks();

      // Verify they're ordered by start time
      expect(blocks[0].startAt).toEqual(new Date('2025-01-20T10:00:00Z'));
      expect(blocks[1].startAt).toEqual(new Date('2025-01-25T10:00:00Z'));
      expect(blocks[2].startAt).toEqual(new Date('2025-01-30T10:00:00Z'));
    });
  });
});
