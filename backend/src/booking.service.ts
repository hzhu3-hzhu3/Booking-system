import prisma from './db';
import { RuleService, ValidationResult } from './rule.service';
import { RoomService } from './room.service';
import { RuleConfig } from '@prisma/client';

export class BookingService {
  private ruleService: RuleService;
  private roomService: RoomService;

  constructor(ruleService: RuleService, roomService: RoomService) {
    this.ruleService = ruleService;
    this.roomService = roomService;
  }

  async validateTimeWindow(startAt: Date, endAt: Date): Promise<ValidationResult> {
    const rules = await this.ruleService.getRules();
    return this.ruleService.validateTimeWindow(startAt, endAt, rules);
  }

  async validateDuration(startAt: Date, endAt: Date): Promise<ValidationResult> {
    const rules = await this.ruleService.getRules();
    return this.ruleService.validateDuration(startAt, endAt, rules);
  }

  async validateHorizon(startAt: Date): Promise<ValidationResult> {
    const rules = await this.ruleService.getRules();
    return this.ruleService.validateHorizon(startAt, rules);
  }

  async checkRoomAvailability(
    roomId: string,
    startAt: Date,
    endAt: Date
  ): Promise<ValidationResult> {
    const room = await this.roomService.getRoomById(roomId);
    
    if (!room) {
      return {
        valid: false,
        error: 'Room not found',
        code: 'ROOM_NOT_FOUND',
      };
    }

    if (room.status === 'archived') {
      return {
        valid: false,
        error: 'Room is archived and cannot be booked',
        code: 'ROOM_ARCHIVED',
      };
    }

    if (room.status === 'maintenance') {
      return {
        valid: false,
        error: 'Room is under maintenance and cannot be booked',
        code: 'ROOM_MAINTENANCE',
      };
    }

    const overlappingBookings = await prisma.booking.findMany({
      where: {
        roomId,
        status: 'confirmed',
        AND: [
          { startAt: { lt: endAt } },
          { endAt: { gt: startAt } },
        ],
      },
    });

    if (overlappingBookings.length > 0) {
      return {
        valid: false,
        error: 'Room is already booked for this time slot',
        code: 'ROOM_UNAVAILABLE',
      };
    }

    const overlappingMaintenance = await prisma.maintenanceBlock.findMany({
      where: {
        roomId,
        AND: [
          { startAt: { lt: endAt } },
          { endAt: { gt: startAt } },
        ],
      },
    });

    if (overlappingMaintenance.length > 0) {
      return {
        valid: false,
        error: 'Room has scheduled maintenance during this time slot',
        code: 'MAINTENANCE_CONFLICT',
      };
    }

    return { valid: true };
  }

  async getUserActiveBookings(userId: string): Promise<any[]> {
    const now = new Date();
    return await prisma.booking.findMany({
      where: {
        userId,
        status: 'confirmed',
        endAt: { gt: now },
      },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            capacity: true,
            equipment: true,
            status: true,
          },
        },
      },
      orderBy: {
        startAt: 'asc',
      },
    });
  }

  async getUserBookings(userId: string): Promise<any[]> {
    return await prisma.booking.findMany({
      where: {
        userId,
      },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            capacity: true,
            equipment: true,
            status: true,
          },
        },
      },
      orderBy: {
        startAt: 'desc',
      },
    });
  }

  async validateMaxActiveBookings(userId: string): Promise<ValidationResult> {
    const rules = await this.ruleService.getRules();
    const activeBookings = await this.getUserActiveBookings(userId);

    if (activeBookings.length >= rules.maxActiveBookings) {
      return {
        valid: false,
        error: `Maximum active bookings limit (${rules.maxActiveBookings}) reached`,
        code: 'MAX_ACTIVE_BOOKINGS_EXCEEDED',
      };
    }

    return { valid: true };
  }

  async validateConsecutiveBookings(
    userId: string,
    roomId: string,
    startAt: Date
  ): Promise<ValidationResult> {
    const rules = await this.ruleService.getRules();

    if (!rules.maxConsecutive) {
      return { valid: true };
    }

    const previousBooking = await prisma.booking.findFirst({
      where: {
        userId,
        roomId,
        status: 'confirmed',
        endAt: startAt,
      },
    });

    if (!previousBooking) {
      return { valid: true };
    }

    let consecutiveCount = 1;
    let currentEndTime = previousBooking.startAt;

    while (consecutiveCount < rules.maxConsecutive) {
      const priorBooking = await prisma.booking.findFirst({
        where: {
          userId,
          roomId,
          status: 'confirmed',
          endAt: currentEndTime,
        },
      });

      if (!priorBooking) {
        break;
      }

      consecutiveCount++;
      currentEndTime = priorBooking.startAt;
    }

    if (consecutiveCount >= rules.maxConsecutive) {
      return {
        valid: false,
        error: `Maximum consecutive bookings limit (${rules.maxConsecutive}) reached for this room`,
        code: 'MAX_CONSECUTIVE_EXCEEDED',
      };
    }

    return { valid: true };
  }

  async validateCooldown(userId: string): Promise<ValidationResult> {
    const rules = await this.ruleService.getRules();

    if (!rules.cooldownMinutes) {
      return { valid: true };
    }

    const mostRecentBooking = await prisma.booking.findFirst({
      where: {
        userId,
        status: 'confirmed',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!mostRecentBooking) {
      return { valid: true };
    }

    const now = new Date();
    const cooldownEndTime = new Date(
      mostRecentBooking.createdAt.getTime() + rules.cooldownMinutes * 60 * 1000
    );

    if (now < cooldownEndTime) {
      const remainingMinutes = Math.ceil(
        (cooldownEndTime.getTime() - now.getTime()) / (60 * 1000)
      );
      return {
        valid: false,
        error: `Cooldown period active. Please wait ${remainingMinutes} more minute(s) before creating another booking`,
        code: 'COOLDOWN_ACTIVE',
      };
    }

    return { valid: true };
  }

  async createBooking(
    userId: string,
    roomId: string,
    startAt: Date,
    endAt: Date
  ): Promise<any> {
    const timeWindowResult = await this.validateTimeWindow(startAt, endAt);
    if (!timeWindowResult.valid) {
      throw new Error(timeWindowResult.error || 'Invalid time window');
    }

    const durationResult = await this.validateDuration(startAt, endAt);
    if (!durationResult.valid) {
      throw new Error(durationResult.error || 'Invalid duration');
    }

    const horizonResult = await this.validateHorizon(startAt);
    if (!horizonResult.valid) {
      throw new Error(horizonResult.error || 'Invalid booking horizon');
    }

    const maxActiveResult = await this.validateMaxActiveBookings(userId);
    if (!maxActiveResult.valid) {
      throw new Error(maxActiveResult.error || 'Maximum active bookings exceeded');
    }

    const consecutiveResult = await this.validateConsecutiveBookings(userId, roomId, startAt);
    if (!consecutiveResult.valid) {
      throw new Error(consecutiveResult.error || 'Consecutive booking limit exceeded');
    }

    const cooldownResult = await this.validateCooldown(userId);
    if (!cooldownResult.valid) {
      throw new Error(cooldownResult.error || 'Cooldown period active');
    }

    try {
      const booking = await prisma.$transaction(
        async (tx) => {
          const room = await tx.room.findUnique({
            where: { id: roomId },
          });

          if (!room) {
            throw new Error('Room not found');
          }

          if (room.status === 'archived') {
            throw new Error('Room is archived and cannot be booked');
          }

          if (room.status === 'maintenance') {
            throw new Error('Room is under maintenance and cannot be booked');
          }

          const overlappingBookings = await tx.booking.findMany({
            where: {
              roomId,
              status: 'confirmed',
              AND: [
                { startAt: { lt: endAt } },
                { endAt: { gt: startAt } },
              ],
            },
          });

          if (overlappingBookings.length > 0) {
            throw new Error('Room is already booked for this time slot');
          }

          const overlappingMaintenance = await tx.maintenanceBlock.findMany({
            where: {
              roomId,
              AND: [
                { startAt: { lt: endAt } },
                { endAt: { gt: startAt } },
              ],
            },
          });

          if (overlappingMaintenance.length > 0) {
            throw new Error('Room has scheduled maintenance during this time slot');
          }

          const newBooking = await tx.booking.create({
            data: {
              userId,
              roomId,
              startAt,
              endAt,
              status: 'confirmed',
            },
            include: {
              room: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                },
              },
            },
          });

          return newBooking;
        },
        {
          isolationLevel: 'Serializable',
          maxWait: 5000,
          timeout: 10000,
        }
      );

      return booking;
    } catch (error: any) {
      throw error;
    }
  }

  async expireOldBookings(): Promise<number> {
    const now = new Date();
    
    const result = await prisma.booking.updateMany({
      where: {
        status: 'confirmed',
        endAt: { lt: now },
      },
      data: {
        status: 'expired',
      },
    });

    return result.count;
  }

  async cancelBooking(
    bookingId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<any> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (!isAdmin && booking.userId !== userId) {
      throw new Error('You can only cancel your own bookings');
    }

    const now = new Date();
    if (booking.endAt <= now) {
      throw new Error('Cannot cancel past bookings');
    }

    if (booking.status === 'cancelled') {
      throw new Error('Booking is already cancelled');
    }

    const cancelledBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: userId,
      },
      include: {
        room: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return cancelledBooking;
  }
}

export const bookingService = new BookingService(
  new RuleService(),
  new RoomService()
);
