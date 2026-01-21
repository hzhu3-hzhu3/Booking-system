import prisma from './db';
import { RuleConfig } from '@prisma/client';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export interface RuleUpdateData {
  openHour?: number;
  closeHour?: number;
  timeSlotIntervalMinutes?: number;
  minDurationMinutes?: number;
  maxDurationMinutes?: number;
  maxActiveBookings?: number;
  maxConsecutive?: number | null;
  cooldownMinutes?: number | null;
  minNoticeMinutes?: number;
  maxDaysAhead?: number;
}

export class RuleService {
  async getRules(): Promise<RuleConfig> {
    const rules = await prisma.ruleConfig.findUnique({
      where: { id: 1 },
    });

    if (!rules) {
      throw new Error('RULES_NOT_FOUND');
    }

    return rules;
  }

  async updateRules(updates: RuleUpdateData): Promise<RuleConfig> {
    const currentRules = await this.getRules();
    const newRules = { ...currentRules, ...updates };

    const validation = this.validateRuleValues(newRules);
    if (!validation.valid) {
      const error = new Error(validation.error);
      error.name = validation.code || 'INVALID_RULE_VALUES';
      throw error;
    }

    const updatedRules = await prisma.ruleConfig.update({
      where: { id: 1 },
      data: updates,
    });

    return updatedRules;
  }

  validateRuleValues(rules: Partial<RuleConfig>): ValidationResult {
    if (rules.openHour !== undefined) {
      if (rules.openHour < 0 || rules.openHour >= 24) {
        return {
          valid: false,
          error: 'openHour must be between 0 and 23',
          code: 'INVALID_OPEN_HOUR',
        };
      }
    }

    if (rules.closeHour !== undefined) {
      if (rules.closeHour < 0 || rules.closeHour > 24) {
        return {
          valid: false,
          error: 'closeHour must be between 0 and 24',
          code: 'INVALID_CLOSE_HOUR',
        };
      }
    }

    if (rules.openHour !== undefined && rules.closeHour !== undefined) {
      if (rules.openHour >= rules.closeHour) {
        return {
          valid: false,
          error: 'openHour must be less than closeHour',
          code: 'INVALID_HOURS',
        };
      }
    }

    if (rules.timeSlotIntervalMinutes !== undefined) {
      if (rules.timeSlotIntervalMinutes <= 0) {
        return {
          valid: false,
          error: 'timeSlotIntervalMinutes must be positive',
          code: 'INVALID_TIME_SLOT_INTERVAL',
        };
      }
    }

    if (rules.minDurationMinutes !== undefined) {
      if (rules.minDurationMinutes <= 0) {
        return {
          valid: false,
          error: 'minDurationMinutes must be positive',
          code: 'INVALID_MIN_DURATION',
        };
      }
    }

    if (rules.maxDurationMinutes !== undefined) {
      if (rules.maxDurationMinutes <= 0) {
        return {
          valid: false,
          error: 'maxDurationMinutes must be positive',
          code: 'INVALID_MAX_DURATION',
        };
      }
    }

    if (rules.minDurationMinutes !== undefined && rules.maxDurationMinutes !== undefined) {
      if (rules.minDurationMinutes > rules.maxDurationMinutes) {
        return {
          valid: false,
          error: 'minDurationMinutes must be less than or equal to maxDurationMinutes',
          code: 'INVALID_DURATION_RANGE',
        };
      }
    }

    if (rules.maxActiveBookings !== undefined) {
      if (rules.maxActiveBookings <= 0) {
        return {
          valid: false,
          error: 'maxActiveBookings must be positive',
          code: 'INVALID_MAX_ACTIVE_BOOKINGS',
        };
      }
    }

    if (rules.maxConsecutive !== undefined && rules.maxConsecutive !== null) {
      if (rules.maxConsecutive <= 0) {
        return {
          valid: false,
          error: 'maxConsecutive must be positive or null',
          code: 'INVALID_MAX_CONSECUTIVE',
        };
      }
    }

    if (rules.cooldownMinutes !== undefined && rules.cooldownMinutes !== null) {
      if (rules.cooldownMinutes < 0) {
        return {
          valid: false,
          error: 'cooldownMinutes must be non-negative or null',
          code: 'INVALID_COOLDOWN',
        };
      }
    }

    if (rules.minNoticeMinutes !== undefined) {
      if (rules.minNoticeMinutes < 0) {
        return {
          valid: false,
          error: 'minNoticeMinutes must be non-negative',
          code: 'INVALID_MIN_NOTICE',
        };
      }
    }

    if (rules.maxDaysAhead !== undefined) {
      if (rules.maxDaysAhead <= 0) {
        return {
          valid: false,
          error: 'maxDaysAhead must be positive',
          code: 'INVALID_MAX_DAYS_AHEAD',
        };
      }
    }

    return { valid: true };
  }

  validateTimeWindow(startAt: Date, endAt: Date, rules: RuleConfig): ValidationResult {
    if (startAt >= endAt) {
      return {
        valid: false,
        error: 'Start time must be before end time',
        code: 'INVALID_TIME_RANGE',
      };
    }

    const startHour = startAt.getUTCHours();
    const startMinute = startAt.getUTCMinutes();
    const endHour = endAt.getUTCHours();
    const endMinute = endAt.getUTCMinutes();

    if (startHour < rules.openHour || (startHour === rules.closeHour && startMinute > 0) || startHour > rules.closeHour) {
      return {
        valid: false,
        error: `Booking must start between ${rules.openHour}:00 and ${rules.closeHour}:00`,
        code: 'OUTSIDE_OPERATING_HOURS',
      };
    }

    if (endHour > rules.closeHour || (endHour === rules.closeHour && endMinute > 0)) {
      return {
        valid: false,
        error: `Booking must end by ${rules.closeHour}:00`,
        code: 'OUTSIDE_OPERATING_HOURS',
      };
    }

    const totalMinutesFromMidnight = startHour * 60 + startMinute;
    if (totalMinutesFromMidnight % rules.timeSlotIntervalMinutes !== 0) {
      return {
        valid: false,
        error: `Start time must align to ${rules.timeSlotIntervalMinutes}-minute intervals`,
        code: 'INVALID_TIME_SLOT',
      };
    }

    return { valid: true };
  }

  validateDuration(startAt: Date, endAt: Date, rules: RuleConfig): ValidationResult {
    const durationMs = endAt.getTime() - startAt.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));

    if (durationMinutes < rules.minDurationMinutes) {
      return {
        valid: false,
        error: `Booking duration must be at least ${rules.minDurationMinutes} minutes`,
        code: 'DURATION_TOO_SHORT',
      };
    }

    if (durationMinutes > rules.maxDurationMinutes) {
      return {
        valid: false,
        error: `Booking duration must not exceed ${rules.maxDurationMinutes} minutes`,
        code: 'DURATION_TOO_LONG',
      };
    }

    return { valid: true };
  }

  validateHorizon(startAt: Date, rules: RuleConfig): ValidationResult {
    const now = new Date();
    const timeDiffMs = startAt.getTime() - now.getTime();
    const timeDiffMinutes = Math.floor(timeDiffMs / (1000 * 60));
    const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

    if (timeDiffMinutes < rules.minNoticeMinutes) {
      return {
        valid: false,
        error: `Booking must be made at least ${rules.minNoticeMinutes} minutes in advance`,
        code: 'TOO_SOON',
      };
    }

    if (timeDiffDays > rules.maxDaysAhead) {
      return {
        valid: false,
        error: `Booking cannot be made more than ${rules.maxDaysAhead} days in advance`,
        code: 'TOO_FAR_AHEAD',
      };
    }

    return { valid: true };
  }
}

export const ruleService = new RuleService();
