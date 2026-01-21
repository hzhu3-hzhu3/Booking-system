import { format as dateFnsFormat } from 'date-fns';

export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function utcToLocal(utcDate: Date | string, timeZone?: string): Date {
  const tz = timeZone || getUserTimezone();
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  
  const utcTime = date.getTime();
  const localString = date.toLocaleString('en-US', { timeZone: tz });
  const localDate = new Date(localString);
  
  const offset = localDate.getTime() - utcTime;
  return new Date(utcTime + offset);
}

export function localToUtc(localDate: Date, timeZone?: string): Date {
  const tz = timeZone || getUserTimezone();
  
  const localString = localDate.toLocaleString('en-US', { timeZone: tz });
  const utcString = localDate.toLocaleString('en-US', { timeZone: 'UTC' });
  
  const localTime = new Date(localString).getTime();
  const utcTime = new Date(utcString).getTime();
  
  const offset = utcTime - localTime;
  return new Date(localDate.getTime() + offset);
}

export function formatUtcForDisplay(
  utcDate: Date | string,
  formatString: string,
  timeZone?: string
): string {
  const localDate = utcToLocal(utcDate, timeZone);
  return dateFnsFormat(localDate, formatString);
}

export function formatLocalForApi(localDate: Date, timeZone?: string): string {
  const utcDate = localToUtc(localDate, timeZone);
  return utcDate.toISOString();
}

export function isDstTransition(date: Date, timeZone: string): boolean {
  try {
    const currentOffset = getTimezoneOffset(date, timeZone);
    const dayBefore = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    const dayAfter = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    
    const offsetBefore = getTimezoneOffset(dayBefore, timeZone);
    const offsetAfter = getTimezoneOffset(dayAfter, timeZone);
    
    return currentOffset !== offsetBefore || currentOffset !== offsetAfter;
  } catch (error) {
    return false;
  }
}

function getTimezoneOffset(date: Date, timeZone: string): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  return (utcDate.getTime() - tzDate.getTime()) / (60 * 1000);
}
