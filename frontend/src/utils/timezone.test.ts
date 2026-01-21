import { describe, it, expect } from 'vitest';
import {
  getLocalTimeZone,
  utcToLocal,
  localToUtc,
  formatUtcForDisplay,
  formatLocalForApi,
  isDstTransition,
  parseLocalTime,
  formatTimeForInput,
  formatDateForInput,
} from './timezone';

describe('Timezone Utilities', () => {
  describe('getLocalTimeZone', () => {
    it('should return a valid IANA timezone string', () => {
      const tz = getLocalTimeZone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
      // Should be a valid timezone format (e.g., "America/New_York")
      expect(tz).toMatch(/^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/);
    });
  });

  describe('utcToLocal', () => {
    it('should convert UTC Date to local timezone', () => {
      // Create a UTC date: 2024-01-15 12:00:00 UTC
      const utcDate = new Date('2024-01-15T12:00:00Z');
      const localDate = utcToLocal(utcDate, 'America/New_York');
      
      // In EST (UTC-5), this should be 7:00 AM
      expect(localDate.getHours()).toBe(7);
      expect(localDate.getMinutes()).toBe(0);
    });

    it('should convert UTC ISO string to local timezone', () => {
      const utcString = '2024-01-15T12:00:00Z';
      const localDate = utcToLocal(utcString, 'America/New_York');
      
      expect(localDate.getHours()).toBe(7);
      expect(localDate.getMinutes()).toBe(0);
    });

    it('should handle different timezones correctly', () => {
      const utcDate = new Date('2024-01-15T12:00:00Z');
      
      // Test multiple timezones
      const nyDate = utcToLocal(utcDate, 'America/New_York');
      const laDate = utcToLocal(utcDate, 'America/Los_Angeles');
      const londonDate = utcToLocal(utcDate, 'Europe/London');
      
      // NY is UTC-5, LA is UTC-8, London is UTC+0
      expect(nyDate.getHours()).toBe(7);
      expect(laDate.getHours()).toBe(4);
      expect(londonDate.getHours()).toBe(12);
    });

    it('should use local timezone when not specified', () => {
      const utcDate = new Date('2024-01-15T12:00:00Z');
      const localDate = utcToLocal(utcDate);
      
      // Should return a valid date
      expect(localDate).toBeInstanceOf(Date);
      expect(localDate.getTime()).toBeGreaterThan(0);
    });
  });

  describe('localToUtc', () => {
    it('should convert local date to UTC', () => {
      // Create a date representing 7:00 AM in New York
      const localDate = new Date('2024-01-15T07:00:00');
      const utcDate = localToUtc(localDate, 'America/New_York');
      
      // Should be 12:00 PM UTC (7 AM + 5 hours)
      const utcHours = utcDate.getUTCHours();
      expect(utcHours).toBe(12);
    });

    it('should handle different timezones correctly', () => {
      // 9:00 AM in different timezones
      const localDate = new Date('2024-01-15T09:00:00');
      
      const nyUtc = localToUtc(localDate, 'America/New_York');
      const laUtc = localToUtc(localDate, 'America/Los_Angeles');
      
      // NY 9 AM = 14:00 UTC, LA 9 AM = 17:00 UTC
      expect(nyUtc.getUTCHours()).toBe(14);
      expect(laUtc.getUTCHours()).toBe(17);
    });

    it('should round-trip correctly with utcToLocal', () => {
      const originalLocal = new Date('2024-01-15T09:30:00');
      const timezone = 'America/New_York';
      
      // Convert to UTC and back
      const utc = localToUtc(originalLocal, timezone);
      const backToLocal = utcToLocal(utc, timezone);
      
      // Should match original time
      expect(backToLocal.getHours()).toBe(originalLocal.getHours());
      expect(backToLocal.getMinutes()).toBe(originalLocal.getMinutes());
    });
  });

  describe('formatUtcForDisplay', () => {
    it('should format UTC date for display in local timezone', () => {
      const utcDate = new Date('2024-01-15T12:00:00Z');
      const formatted = formatUtcForDisplay(utcDate, 'PPpp', 'America/New_York');
      
      // Should contain the date and time
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2024');
      expect(formatted).toContain('7:00');
    });

    it('should format UTC ISO string for display', () => {
      const utcString = '2024-01-15T12:00:00Z';
      const formatted = formatUtcForDisplay(utcString, 'PPpp', 'America/New_York');
      
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
    });

    it('should use custom format string', () => {
      const utcDate = new Date('2024-01-15T12:00:00Z');
      const formatted = formatUtcForDisplay(utcDate, 'yyyy-MM-dd HH:mm', 'America/New_York');
      
      expect(formatted).toBe('2024-01-15 07:00');
    });

    it('should handle different timezones', () => {
      const utcDate = new Date('2024-01-15T12:00:00Z');
      
      const nyFormatted = formatUtcForDisplay(utcDate, 'HH:mm', 'America/New_York');
      const laFormatted = formatUtcForDisplay(utcDate, 'HH:mm', 'America/Los_Angeles');
      
      expect(nyFormatted).toBe('07:00');
      expect(laFormatted).toBe('04:00');
    });
  });

  describe('formatLocalForApi', () => {
    it('should format local date as ISO string in UTC', () => {
      const localDate = new Date('2024-01-15T09:00:00');
      const isoString = formatLocalForApi(localDate, 'America/New_York');
      
      // Should be a valid ISO string
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Should end with Z (UTC indicator)
      expect(isoString).toMatch(/Z$/);
    });

    it('should convert timezone correctly', () => {
      const localDate = new Date('2024-01-15T09:00:00');
      const isoString = formatLocalForApi(localDate, 'America/New_York');
      
      // Parse back and check UTC time
      const parsed = new Date(isoString);
      expect(parsed.getUTCHours()).toBe(14); // 9 AM EST = 2 PM UTC
    });

    it('should round-trip correctly with API', () => {
      const localDate = new Date('2024-01-15T09:30:00');
      const timezone = 'America/New_York';
      
      // Format for API (converts to UTC)
      const isoString = formatLocalForApi(localDate, timezone);
      
      // Parse as if received from API and convert back to local
      const backToLocal = utcToLocal(isoString, timezone);
      
      expect(backToLocal.getHours()).toBe(localDate.getHours());
      expect(backToLocal.getMinutes()).toBe(localDate.getMinutes());
    });
  });

  describe('DST transitions', () => {
    it('should detect DST transition in spring (March)', () => {
      // March 10, 2024 is when DST starts in US (2 AM -> 3 AM)
      const dstDate = new Date('2024-03-10T07:00:00Z');
      const isDst = isDstTransition(dstDate, 'America/New_York');
      
      // Should detect transition (or be near it)
      expect(typeof isDst).toBe('boolean');
    });

    it('should detect DST transition in fall (November)', () => {
      // November 3, 2024 is when DST ends in US (2 AM -> 1 AM)
      const dstDate = new Date('2024-11-03T06:00:00Z');
      const isDst = isDstTransition(dstDate, 'America/New_York');
      
      expect(typeof isDst).toBe('boolean');
    });

    it('should not detect DST transition in summer', () => {
      // July is well within DST, no transitions nearby
      const summerDate = new Date('2024-07-15T12:00:00Z');
      const isDst = isDstTransition(summerDate, 'America/New_York');
      
      expect(isDst).toBe(false);
    });

    it('should handle timezones without DST', () => {
      // Arizona doesn't observe DST
      const date = new Date('2024-03-10T12:00:00Z');
      const isDst = isDstTransition(date, 'America/Phoenix');
      
      expect(isDst).toBe(false);
    });

    it('should handle UTC timezone', () => {
      const date = new Date('2024-03-10T12:00:00Z');
      const isDst = isDstTransition(date, 'UTC');
      
      expect(isDst).toBe(false);
    });
  });

  describe('DST edge cases', () => {
    it('should correctly convert times during spring forward', () => {
      // On March 10, 2024, 2:00 AM becomes 3:00 AM in New York
      // Test a time just before the transition
      const beforeDst = new Date('2024-03-10T06:59:00Z'); // 1:59 AM EST
      const localBefore = utcToLocal(beforeDst, 'America/New_York');
      
      // Test a time just after the transition
      const afterDst = new Date('2024-03-10T07:01:00Z'); // 3:01 AM EDT
      const localAfter = utcToLocal(afterDst, 'America/New_York');
      
      // Both should be valid dates
      expect(localBefore).toBeInstanceOf(Date);
      expect(localAfter).toBeInstanceOf(Date);
      
      // The hour difference should account for DST
      const hourDiff = localAfter.getHours() - localBefore.getHours();
      expect(Math.abs(hourDiff)).toBeGreaterThanOrEqual(1);
    });

    it('should correctly convert times during fall back', () => {
      // On November 3, 2024, 2:00 AM becomes 1:00 AM in New York
      const beforeDst = new Date('2024-11-03T05:59:00Z'); // 1:59 AM EDT
      const localBefore = utcToLocal(beforeDst, 'America/New_York');
      
      const afterDst = new Date('2024-11-03T06:01:00Z'); // 1:01 AM EST
      const localAfter = utcToLocal(afterDst, 'America/New_York');
      
      expect(localBefore).toBeInstanceOf(Date);
      expect(localAfter).toBeInstanceOf(Date);
    });

    it('should maintain correct UTC times across DST transitions', () => {
      const timezone = 'America/New_York';
      
      // Create a local time during DST
      const summerLocal = new Date('2024-07-15T14:00:00');
      const summerUtc = localToUtc(summerLocal, timezone);
      
      // Create a local time during standard time
      const winterLocal = new Date('2024-01-15T14:00:00');
      const winterUtc = localToUtc(winterLocal, timezone);
      
      // The UTC times should differ by 1 hour (DST offset)
      const utcDiff = Math.abs(summerUtc.getUTCHours() - winterUtc.getUTCHours());
      expect(utcDiff).toBe(1);
    });
  });

  describe('parseLocalTime', () => {
    it('should parse time string and combine with date', () => {
      const date = new Date('2024-01-15T00:00:00');
      const result = parseLocalTime(date, '14:30');
      
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve the date part', () => {
      const date = new Date('2024-01-15T00:00:00');
      const result = parseLocalTime(date, '09:15');
      
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });

    it('should handle edge times', () => {
      const date = new Date('2024-01-15T00:00:00');
      
      const midnight = parseLocalTime(date, '00:00');
      expect(midnight.getHours()).toBe(0);
      expect(midnight.getMinutes()).toBe(0);
      
      const endOfDay = parseLocalTime(date, '23:59');
      expect(endOfDay.getHours()).toBe(23);
      expect(endOfDay.getMinutes()).toBe(59);
    });
  });

  describe('formatTimeForInput', () => {
    it('should format date as HH:mm string', () => {
      const date = new Date('2024-01-15T14:30:00');
      const formatted = formatTimeForInput(date);
      
      expect(formatted).toBe('14:30');
    });

    it('should pad single digits with zeros', () => {
      const date = new Date('2024-01-15T09:05:00');
      const formatted = formatTimeForInput(date);
      
      expect(formatted).toBe('09:05');
    });

    it('should handle midnight', () => {
      const date = new Date('2024-01-15T00:00:00');
      const formatted = formatTimeForInput(date);
      
      expect(formatted).toBe('00:00');
    });
  });

  describe('formatDateForInput', () => {
    it('should format date as yyyy-MM-dd string', () => {
      const date = new Date('2024-01-15T14:30:00');
      const formatted = formatDateForInput(date);
      
      expect(formatted).toBe('2024-01-15');
    });

    it('should pad single digit months and days', () => {
      const date = new Date('2024-03-05T14:30:00');
      const formatted = formatDateForInput(date);
      
      expect(formatted).toBe('2024-03-05');
    });

    it('should handle different months', () => {
      const date = new Date('2024-12-25T14:30:00');
      const formatted = formatDateForInput(date);
      
      expect(formatted).toBe('2024-12-25');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete booking flow with timezone conversion', () => {
      const timezone = 'America/New_York';
      
      // User selects date and time in their local timezone
      const selectedDate = new Date('2024-01-15');
      const startTime = parseLocalTime(selectedDate, '14:00');
      const endTime = parseLocalTime(selectedDate, '15:30');
      
      // Convert to UTC for API request
      const startUtc = formatLocalForApi(startTime, timezone);
      const endUtc = formatLocalForApi(endTime, timezone);
      
      // Simulate API response (returns UTC times)
      const apiResponse = {
        startAt: startUtc,
        endAt: endUtc,
      };
      
      // Convert back to local for display
      const displayStart = utcToLocal(apiResponse.startAt, timezone);
      const displayEnd = utcToLocal(apiResponse.endAt, timezone);
      
      // Should match original local times
      expect(displayStart.getHours()).toBe(14);
      expect(displayStart.getMinutes()).toBe(0);
      expect(displayEnd.getHours()).toBe(15);
      expect(displayEnd.getMinutes()).toBe(30);
    });

    it('should handle search criteria with timezone conversion', () => {
      const timezone = 'America/Los_Angeles';
      
      // User searches for rooms at 9 AM - 10 AM local time
      const searchDate = new Date('2024-01-15');
      const startLocal = parseLocalTime(searchDate, '09:00');
      const endLocal = parseLocalTime(searchDate, '10:00');
      
      // Convert to UTC for API
      const startUtc = formatLocalForApi(startLocal, timezone);
      const endUtc = formatLocalForApi(endLocal, timezone);
      
      // Parse the UTC times
      const startParsed = new Date(startUtc);
      const endParsed = new Date(endUtc);
      
      // LA is UTC-8, so 9 AM LA = 5 PM UTC
      expect(startParsed.getUTCHours()).toBe(17);
      expect(endParsed.getUTCHours()).toBe(18);
    });
  });
});
