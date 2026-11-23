/** Builds an inclusive timestamp for a calendar day in the hotel's operational timezone. */
export function reportingDateBoundary(day: string, end: boolean, timeZone = 'Africa/Cairo'): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const clock = end ? '23:59:59.999' : '00:00:00.000';
  const outputClock = end ? '23:59:59.999999' : clock;
  const localGuess = new Date(`${day}T${clock}Z`);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(localGuess);
  const value = (name: string) => Number(parts.find((part) => part.type === name)?.value ?? 0);
  const represented = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  const offsetMinutes = Math.round((represented - localGuess.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return `${day}T${outputClock}${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

export function formatOperationalDateTime(value: string | null | undefined, timeZone = 'Africa/Cairo'): string {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value)) : '—';
}
