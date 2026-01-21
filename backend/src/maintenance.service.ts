import prisma from './db';
import { MaintenanceBlock } from '@prisma/client';

export interface CreateMaintenanceBlockData {
  roomId: string;
  startAt: Date;
  endAt: Date;
  reason?: string;
}

export interface GetMaintenanceBlocksFilter {
  roomId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class MaintenanceBlockService {
  async createMaintenanceBlock(data: CreateMaintenanceBlockData): Promise<MaintenanceBlock> {
    if (data.startAt >= data.endAt) {
      const error = new Error('Start time must be before end time');
      error.name = 'INVALID_TIME_RANGE';
      throw error;
    }

    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room) {
      const error = new Error('Room not found');
      error.name = 'ROOM_NOT_FOUND';
      throw error;
    }

    const maintenanceBlock = await prisma.maintenanceBlock.create({
      data: {
        roomId: data.roomId,
        startAt: data.startAt,
        endAt: data.endAt,
        reason: data.reason || null,
      },
    });

    return maintenanceBlock;
  }

  async deleteMaintenanceBlock(id: string): Promise<void> {
    const existingBlock = await prisma.maintenanceBlock.findUnique({
      where: { id },
    });

    if (!existingBlock) {
      const error = new Error('Maintenance block not found');
      error.name = 'MAINTENANCE_BLOCK_NOT_FOUND';
      throw error;
    }

    await prisma.maintenanceBlock.delete({
      where: { id },
    });
  }

  async getMaintenanceBlocks(filter?: GetMaintenanceBlocksFilter): Promise<MaintenanceBlock[]> {
    const whereClause: any = {};

    if (filter?.roomId) {
      whereClause.roomId = filter.roomId;
    }

    if (filter?.startDate || filter?.endDate) {
      whereClause.AND = [];

      if (filter.startDate) {
        whereClause.AND.push({
          endAt: { gte: filter.startDate },
        });
      }

      if (filter.endDate) {
        whereClause.AND.push({
          startAt: { lte: filter.endDate },
        });
      }
    }

    const maintenanceBlocks = await prisma.maintenanceBlock.findMany({
      where: whereClause,
      orderBy: {
        startAt: 'asc',
      },
    });

    return maintenanceBlocks;
  }
}

export const maintenanceBlockService = new MaintenanceBlockService();
