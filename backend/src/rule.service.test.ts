import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RuleService } from './rule.service';
import prisma from './db';

describe('RuleService', () => {
  let ruleService: RuleService;

  beforeEach(() => {
    ruleService = new RuleService();
  });

  afterEach(async () => {
    // Reset rules to default values after each test
    await prisma.ruleConfig.update({
      where: { id: 1 },
      data: {
        openHour: 8,
        closeHour: 22,
        timeSlotIntervalMinutes: 15,
        minDurationMinutes: 30,
        maxDurationMinutes: 120,
        maxActiveBookings: 3,
        maxConsecutive: null,
        cooldownMinutes: null,
        minNoticeMinutes: 30,
        maxDaysAhead: 14,
      },
    });
  });

  describe('getRules', () => {
    it('should return current rule configuration', async () => {
      const rules = await ruleService.getRules();

      expect(rules).toBeDefined();
      expect(rules.id).toBe(1);
      expect(rules.openHour).toBeDefined();
      expect(rules.closeHour).toBeDefined();
      expect(rules.minDurationMinutes).toBeDefined();
      expect(rules.maxDurationMinutes).toBeDefined();
    });
  });

  describe('updateRules', () => {
    it('should update rules with valid values', async () => {
      const updates = {
        openHour: 9,
        closeHour: 21,
        minDurationMinutes: 45,
        maxDurationMinutes: 180,
      };

      const updatedRules = await ruleService.updateRules(updates);

      expect(updatedRules.openHour).toBe(9);
      expect(updatedRules.closeHour).toBe(21);
      expect(updatedRules.minDurationMinutes).toBe(45);
      expect(updatedRules.maxDurationMinutes).toBe(180);
    });

    it('should reject invalid openHour', async () => {
      await expect(
        ruleService.updateRules({ openHour: -1 })
      ).rejects.toThrow();

      await expect(
        ruleService.updateRules({ openHour: 24 })
      ).rejects.toThrow();
    });

    it('should reject invalid closeHour', async () => {
      await expect(
        ruleService.updateRules({ closeHour: -1 })
      ).rejects.toThrow();

      await expect(
        ruleService.updateRules({ closeHour: 25 })
      ).rejects.toThrow();
    });

    it('should reject openHour >= closeHour', async () => {
      await expect(
        ruleService.updateRules({ openHour: 22, closeHour: 22 })
      ).rejects.toThrow();

      await expect(
        ruleService.updateRules({ openHour: 23, closeHour: 22 })
      ).rejects.toThrow();
    });

    it('should reject invalid timeSlotIntervalMinutes', async () => {
      await expect(
        ruleService.updateRules({ timeSlotIntervalMinutes: 0 })
      ).rejects.toThrow();

      await expect(
        ruleService.updateRules({ timeSlotIntervalMinutes: -5 })
      ).rejects.toThrow();
    });

    it('should reject invalid minDurationMinutes', async () => {
      await expect(
        ruleService.updateRules({ minDurationMinutes: 0 })
      ).rejects.toThrow();

      await expect(
        ruleService.updateRules({ minDurationMinutes: -10 })
      ).rejects.toThrow();
    });

    it('should reject invalid maxDurationMinutes', async () => {
      await expect(
        ruleService.updateRules({ maxDurationMinutes: 0 })
      ).rejects.toThrow();

      await expect(
        ruleService.updateRules({ maxDurationMinutes: -10 })
      ).rejects.toThrow();
    });

    it('should reject minDurationMinutes > maxDurationMinutes', async () => {
      await expect(
        ruleService.updateRules({ minDurationMinutes: 120, maxDurationMinutes: 60 })
      ).rejects.toThrow();
    });

    it('should reject invalid maxActiveBookings', async () => {
      await expect(
        ruleService.updateRules({ maxActiveBookings: 0 })
      ).rejects.toThrow();

      await expect(
        ruleService.updateRules({ maxActiveBookings: -1 })
      ).rejects.toThrow();
    });

    it('should reject invalid maxConsecutive', async () => {
      await expect(
        ruleService.updateRules({ maxConsecutive: 0 })
      ).rejects.toThrow();

      await expect(
        ruleService.updateRules({ maxConsecutive: -1 })
      ).rejects.toThrow();
    });

    it('should accept null maxConsecutive', async () => {
      const updatedRules = await ruleService.updateRules({ maxConsecutive: null });
      expect(updatedRules.maxConsecutive).toBeNull();
    });

    it('should reject invalid cooldownMinutes', async () => {
      await expect(
        ruleService.updateRules({ cooldownMinutes: -1 })
      ).rejects.toThrow();
    });

    it('should accept null cooldownMinutes', async () => {
      const updatedRules = await ruleService.updateRules({ cooldownMinutes: null });
      expect(updatedRules.cooldownMinutes).toBeNull();
    });

    it('should reject invalid minNoticeMinutes', async () => {
      await expect(
        ruleService.updateRules({ minNoticeMinutes: -1 })
      ).rejects.toThrow();
    });

    it('should reject invalid maxDaysAhead', async () => {
      await expect(
        ruleService.updateRules({ maxDaysAhead: 0 })
      ).rejects.toThrow();

      await expect(
        ruleService.updateRules({ maxDaysAhead: -1 })
      ).rejects.toThrow();
    });
  });

  describe('validateTimeWindow', () => {
    it('should validate time within operating hours', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date('2025-01-20T10:00:00Z'); // 10:00 UTC
      const endAt = new Date('2025-01-20T11:00:00Z');   // 11:00 UTC

      const result = ruleService.validateTimeWindow(startAt, endAt, rules);
      expect(result.valid).toBe(true);
    });

    it('should reject start time before end time validation', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date('2025-01-20T11:00:00Z');
      const endAt = new Date('2025-01-20T10:00:00Z');

      const result = ruleService.validateTimeWindow(startAt, endAt, rules);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_TIME_RANGE');
    });

    it('should reject time outside operating hours', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date('2025-01-20T06:00:00Z'); // Before openHour
      const endAt = new Date('2025-01-20T07:00:00Z');

      const result = ruleService.validateTimeWindow(startAt, endAt, rules);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('OUTSIDE_OPERATING_HOURS');
    });

    it('should reject time slot not aligned to interval', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date('2025-01-20T10:07:00Z'); // Not aligned to 15-min interval
      const endAt = new Date('2025-01-20T11:07:00Z');

      const result = ruleService.validateTimeWindow(startAt, endAt, rules);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_TIME_SLOT');
    });
  });

  describe('validateDuration', () => {
    it('should validate duration within limits', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date('2025-01-20T10:00:00Z');
      const endAt = new Date('2025-01-20T11:00:00Z'); // 60 minutes

      const result = ruleService.validateDuration(startAt, endAt, rules);
      expect(result.valid).toBe(true);
    });

    it('should reject duration below minimum', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date('2025-01-20T10:00:00Z');
      const endAt = new Date('2025-01-20T10:15:00Z'); // 15 minutes (below 30 min minimum)

      const result = ruleService.validateDuration(startAt, endAt, rules);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('DURATION_TOO_SHORT');
    });

    it('should reject duration above maximum', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date('2025-01-20T10:00:00Z');
      const endAt = new Date('2025-01-20T13:00:00Z'); // 180 minutes (above 120 min maximum)

      const result = ruleService.validateDuration(startAt, endAt, rules);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('DURATION_TOO_LONG');
    });

    it('should accept duration exactly at minimum', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date('2025-01-20T10:00:00Z');
      const endAt = new Date('2025-01-20T10:30:00Z'); // Exactly 30 minutes

      const result = ruleService.validateDuration(startAt, endAt, rules);
      expect(result.valid).toBe(true);
    });

    it('should accept duration exactly at maximum', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date('2025-01-20T10:00:00Z');
      const endAt = new Date('2025-01-20T12:00:00Z'); // Exactly 120 minutes

      const result = ruleService.validateDuration(startAt, endAt, rules);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateHorizon', () => {
    it('should validate booking within horizon limits', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

      const result = ruleService.validateHorizon(startAt, rules);
      expect(result.valid).toBe(true);
    });

    it('should reject booking too soon', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now (below 30 min minimum)

      const result = ruleService.validateHorizon(startAt, rules);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('TOO_SOON');
    });

    it('should reject booking too far ahead', async () => {
      const rules = await ruleService.getRules();
      const startAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days from now (above 14 days maximum)

      const result = ruleService.validateHorizon(startAt, rules);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('TOO_FAR_AHEAD');
    });
  });
});
