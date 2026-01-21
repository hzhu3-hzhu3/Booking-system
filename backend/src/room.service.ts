import prisma from './db';
import { Room, RoomStatus } from '@prisma/client';

export interface CreateRoomData {
  name: string;
  capacity: number;
  equipment: string[];
  status: RoomStatus;
}

export interface UpdateRoomData {
  name?: string;
  capacity?: number;
  equipment?: string[];
  status?: RoomStatus;
}

export interface SearchCriteria {
  date: Date;
  startTime: string;
  endTime: string;
  minCapacity?: number;
  equipmentTags?: string[];
}

export interface TimeSlot {
  startAt: Date;
  endAt: Date;
}

export interface RoomAvailability {
  id: string;
  name: string;
  capacity: number;
  equipment: string[];
  availabilityStatus: 'available' | 'partially_available' | 'unavailable' | 'maintenance';
  availableSlots?: TimeSlot[];
}

export class RoomService {
  async createRoom(data: CreateRoomData): Promise<Room> {
    const existingRoom = await prisma.room.findUnique({
      where: { name: data.name },
    });

    if (existingRoom) {
      const error = new Error('Room name already exists');
      error.name = 'DUPLICATE_NAME';
      throw error;
    }

    const room = await prisma.room.create({
      data: {
        name: data.name,
        capacity: data.capacity,
        equipment: data.equipment,
        status: data.status,
      },
    });

    return room;
  }

  async updateRoom(id: string, data: UpdateRoomData): Promise<Room> {
    const existingRoom = await prisma.room.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      const error = new Error('Room not found');
      error.name = 'ROOM_NOT_FOUND';
      throw error;
    }

    if (data.name && data.name !== existingRoom.name) {
      const duplicateRoom = await prisma.room.findUnique({
        where: { name: data.name },
      });

      if (duplicateRoom) {
        const error = new Error('Room name already exists');
        error.name = 'DUPLICATE_NAME';
        throw error;
      }
    }

    if (data.status) {
      const validStatuses: RoomStatus[] = ['active', 'maintenance', 'archived'];
      if (!validStatuses.includes(data.status)) {
        const error = new Error('Invalid room status');
        error.name = 'INVALID_STATUS';
        throw error;
      }
    }

    const updatedRoom = await prisma.room.update({
      where: { id },
      data,
    });

    return updatedRoom;
  }

  async archiveRoom(id: string): Promise<Room> {
    const existingRoom = await prisma.room.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      const error = new Error('Room not found');
      error.name = 'ROOM_NOT_FOUND';
      throw error;
    }

    const archivedRoom = await prisma.room.update({
      where: { id },
      data: { status: 'archived' },
    });

    return archivedRoom;
  }

  async getRoomById(id: string): Promise<Room | null> {
    const room = await prisma.room.findUnique({
      where: { id },
    });

    return room;
  }

  async getAllRooms(): Promise<Room[]> {
    const rooms = await prisma.room.findMany({
      orderBy: [
        { status: 'asc' },
        { name: 'asc' },
      ],
    });

    return rooms;
  }

  async searchRooms(criteria: SearchCriteria): Promise<RoomAvailability[]> {
    const { date, startTime, endTime, minCapacity, equipmentTags } = criteria;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startAt = new Date(date);
    startAt.setUTCHours(startHour, startMinute, 0, 0);

    const endAt = new Date(date);
    endAt.setUTCHours(endHour, endMinute, 0, 0);

    const whereClause: any = {};

    if (minCapacity !== undefined) {
      whereClause.capacity = { gte: minCapacity };
    }

    let rooms = await prisma.room.findMany({
      where: whereClause,
      include: {
        bookings: {
          where: {
            status: 'confirmed',
            OR: [
              {
                AND: [
                  { startAt: { lt: endAt } },
                  { endAt: { gt: startAt } },
                ],
              },
            ],
          },
        },
        maintenanceBlocks: {
          where: {
            AND: [
              { startAt: { lt: endAt } },
              { endAt: { gt: startAt } },
            ],
          },
        },
      },
    });

    if (equipmentTags && equipmentTags.length > 0) {
      rooms = rooms.filter((room) => {
        const roomEquipment = Array.isArray(room.equipment) ? room.equipment : [];
        return equipmentTags.every((tag) => roomEquipment.includes(tag));
      });
    }

    const roomAvailabilities: RoomAvailability[] = rooms.map((room) => {
      const equipment = Array.isArray(room.equipment) ? room.equipment : [];

      if (room.status === 'maintenance') {
        return {
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          equipment,
          availabilityStatus: 'maintenance',
        };
      }

      if (room.status === 'archived') {
        return {
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          equipment,
          availabilityStatus: 'unavailable',
        };
      }

      const hasBookingConflict = room.bookings.length > 0;
      const hasMaintenanceConflict = room.maintenanceBlocks.length > 0;

      if (hasMaintenanceConflict) {
        return {
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          equipment,
          availabilityStatus: 'maintenance',
        };
      }

      if (hasBookingConflict) {
        return {
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          equipment,
          availabilityStatus: 'unavailable',
        };
      }

      return {
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        equipment,
        availabilityStatus: 'available',
      };
    });

    return roomAvailabilities;
  }
}

export const roomService = new RoomService();
