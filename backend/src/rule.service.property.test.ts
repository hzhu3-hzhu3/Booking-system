import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { RuleService } from './rule.service';

describe('RuleService Property Tests', () => {
  const ruleService = new RuleService();

  // Feature: breakout-room-booking, Property 31: Invalid rule values are rejected
  describe('Property 31: Invalid rule values are rejected', () => {
    it('should reject openHour outside valid range', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ max: -1 }), // Negative values
            fc.integer({ min: 24 })  // Values >= 24
          ),
          (invalidOpenHour) => {
            const result = ruleService.validateRuleValues({ openHour: invalidOpenHour });
            expect(result.valid).toBe(false);
            expect(result.code).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject closeHour outside valid range', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ max: -1 }),  // Negative values
            fc.integer({ min: 25 })   // Values > 24
          ),
          (invalidCloseHour) => {
            const result = ruleService.validateRuleValues({ closeHour: invalidCloseHour });
            expect(result.valid).toBe(false);
            expect(result.code).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject openHour >= closeHour', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),  // Valid openHour range
          fc.integer({ min: 0, max: 24 }),  // Valid closeHour range
          (hour1, hour2) => {
            // Ensure openHour >= closeHour with valid individual values
            const openHour = Math.max(hour1, hour2);
            const closeHour = Math.min(hour1, hour2);
            
            // Only test when both values are individually valid
            if (openHour >= 0 && openHour < 24 && closeHour >= 0 && closeHour <= 24) {
              if (openHour >= closeHour) {
                const result = ruleService.validateRuleValues({ 
                  openHour, 
                  closeHour 
                });
                expect(result.valid).toBe(false);
                expect(result.code).toBe('INVALID_HOURS');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-positive timeSlotIntervalMinutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          (invalidInterval) => {
            const result = ruleService.validateRuleValues({ 
              timeSlotIntervalMinutes: invalidInterval 
            });
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_TIME_SLOT_INTERVAL');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-positive minDurationMinutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          (invalidDuration) => {
            const result = ruleService.validateRuleValues({ 
              minDurationMinutes: invalidDuration 
            });
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_MIN_DURATION');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-positive maxDurationMinutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          (invalidDuration) => {
            const result = ruleService.validateRuleValues({ 
              maxDurationMinutes: invalidDuration 
            });
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_MAX_DURATION');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject minDurationMinutes > maxDurationMinutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          (duration1, duration2) => {
            // Ensure min > max
            const minDuration = Math.max(duration1, duration2);
            const maxDuration = Math.min(duration1, duration2);
            
            if (minDuration > maxDuration) {
              const result = ruleService.validateRuleValues({ 
                minDurationMinutes: minDuration,
                maxDurationMinutes: maxDuration
              });
              expect(result.valid).toBe(false);
              expect(result.code).toBe('INVALID_DURATION_RANGE');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-positive maxActiveBookings', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          (invalidMax) => {
            const result = ruleService.validateRuleValues({ 
              maxActiveBookings: invalidMax 
            });
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_MAX_ACTIVE_BOOKINGS');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-positive maxConsecutive (when not null)', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          (invalidMax) => {
            const result = ruleService.validateRuleValues({ 
              maxConsecutive: invalidMax 
            });
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_MAX_CONSECUTIVE');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject negative cooldownMinutes (when not null)', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: -1 }),
          (invalidCooldown) => {
            const result = ruleService.validateRuleValues({ 
              cooldownMinutes: invalidCooldown 
            });
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_COOLDOWN');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject negative minNoticeMinutes', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: -1 }),
          (invalidNotice) => {
            const result = ruleService.validateRuleValues({ 
              minNoticeMinutes: invalidNotice 
            });
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_MIN_NOTICE');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-positive maxDaysAhead', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          (invalidDays) => {
            const result = ruleService.validateRuleValues({ 
              maxDaysAhead: invalidDays 
            });
            expect(result.valid).toBe(false);
            expect(result.code).toBe('INVALID_MAX_DAYS_AHEAD');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid rule values', () => {
      fc.assert(
        fc.property(
          fc.record({
            openHour: fc.integer({ min: 0, max: 22 }),
            closeHour: fc.integer({ min: 1, max: 24 }),
            timeSlotIntervalMinutes: fc.integer({ min: 1, max: 60 }),
            minDurationMinutes: fc.integer({ min: 1, max: 100 }),
            maxDurationMinutes: fc.integer({ min: 101, max: 500 }),
            maxActiveBookings: fc.integer({ min: 1, max: 20 }),
            maxConsecutive: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
            cooldownMinutes: fc.option(fc.integer({ min: 0, max: 120 }), { nil: null }),
            minNoticeMinutes: fc.integer({ min: 0, max: 120 }),
            maxDaysAhead: fc.integer({ min: 1, max: 365 }),
          }),
          (rules) => {
            // Ensure openHour < closeHour
            if (rules.openHour >= rules.closeHour) {
              return true; // Skip this case
            }
            
            const result = ruleService.validateRuleValues(rules);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.code).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
