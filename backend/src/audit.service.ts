import prisma from './db';
import { AuditLog } from '@prisma/client';

export interface LogActionParams {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: any;
}

export interface GetAuditLogsParams {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLogService {
  async logAction(params: LogActionParams): Promise<AuditLog> {
    const { actorId, action, entityType, entityId, payload } = params;

    const auditLog = await prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action,
        entityType,
        entityId: entityId || null,
        payload: payload || null,
      },
    });

    return auditLog;
  }

  async getAuditLogs(params: GetAuditLogsParams = {}): Promise<AuditLog[]> {
    const {
      actorId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = params;

    const whereClause: any = {};

    if (actorId) {
      whereClause.actorId = actorId;
    }

    if (entityType) {
      whereClause.entityType = entityType;
    }

    if (entityId) {
      whereClause.entityId = entityId;
    }

    if (action) {
      whereClause.action = action;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = startDate;
      }
      if (endDate) {
        whereClause.createdAt.lte = endDate;
      }
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return auditLogs;
  }

  async logBookingCreated(actorId: string, bookingId: string, payload: any): Promise<AuditLog> {
    return this.logAction({
      actorId,
      action: 'booking_created',
      entityType: 'booking',
      entityId: bookingId,
      payload,
    });
  }

  async logBookingCancelled(actorId: string, bookingId: string, payload: any): Promise<AuditLog> {
    return this.logAction({
      actorId,
      action: 'booking_cancelled',
      entityType: 'booking',
      entityId: bookingId,
      payload,
    });
  }

  async logBookingExpired(bookingId: string, payload: any): Promise<AuditLog> {
    return this.logAction({
      action: 'booking_expired',
      entityType: 'booking',
      entityId: bookingId,
      payload,
    });
  }

  async logRoomCreated(actorId: string, roomId: string, payload: any): Promise<AuditLog> {
    return this.logAction({
      actorId,
      action: 'room_created',
      entityType: 'room',
      entityId: roomId,
      payload,
    });
  }

  async logRoomUpdated(actorId: string, roomId: string, payload: any): Promise<AuditLog> {
    return this.logAction({
      actorId,
      action: 'room_updated',
      entityType: 'room',
      entityId: roomId,
      payload,
    });
  }

  async logRoomArchived(actorId: string, roomId: string, payload: any): Promise<AuditLog> {
    return this.logAction({
      actorId,
      action: 'room_archived',
      entityType: 'room',
      entityId: roomId,
      payload,
    });
  }

  async logRulesUpdated(actorId: string, payload: any): Promise<AuditLog> {
    return this.logAction({
      actorId,
      action: 'rules_updated',
      entityType: 'rule_config',
      payload,
    });
  }

  async logMaintenanceBlockCreated(actorId: string, blockId: string, payload: any): Promise<AuditLog> {
    return this.logAction({
      actorId,
      action: 'maintenance_block_created',
      entityType: 'maintenance_block',
      entityId: blockId,
      payload,
    });
  }

  async logMaintenanceBlockDeleted(actorId: string, blockId: string, payload: any): Promise<AuditLog> {
    return this.logAction({
      actorId,
      action: 'maintenance_block_deleted',
      entityType: 'maintenance_block',
      entityId: blockId,
      payload,
    });
  }
}

export const auditLogService = new AuditLogService();
