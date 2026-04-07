export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const VIETNAM_UTC_OFFSET = '+07:00';

function getTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const lookup: Record<string, string> = {};
  for (const p of parts) {
    if (p.type === 'year' || p.type === 'month' || p.type === 'day' || p.type === 'hour' || p.type === 'minute' || p.type === 'second') {
      lookup[p.type] = p.value;
    }
  }

  return {
    year: lookup.year ?? '0000',
    month: lookup.month ?? '00',
    day: lookup.day ?? '00',
    hour: lookup.hour ?? '00',
    minute: lookup.minute ?? '00',
    second: lookup.second ?? '00'
  };
}

/**
 * ISO-like timestamp in Vietnam time.
 * Example: 2026-04-07T12:34:56.123+07:00
 */
export function isoVietnam(date: Date = new Date()) {
  const { year, month, day, hour, minute, second } = getTimeParts(date, VIETNAM_TIMEZONE);
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${VIETNAM_UTC_OFFSET}`;
}

/**
 * Artifact/file stamp in Vietnam time.
 * Example: 20260407_123456
 */
export function stamp(date: Date = new Date()) {
  const { year, month, day, hour, minute, second } = getTimeParts(date, VIETNAM_TIMEZONE);
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

/**
 * Parse a KiotViet UI datetime string in Vietnam locale.
 *
 * Expected formats:
 * - dd/MM/yyyy HH:mm
 * - dd/MM/yyyy HH:mm:ss
 *
 * Returns epoch milliseconds, or null if parsing fails.
 */
export function parseVietnamUiDateTimeToMs(input: string): number | null {
  const s = input.trim();
  const m = /^([0-3]\d)\/([01]\d)\/(\d{4})\s+([0-2]\d):([0-5]\d)(?::([0-5]\d))?$/.exec(s);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? '0');

  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mi = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  const iso = `${year}-${mm}-${dd}T${hh}:${mi}:${ss}${VIETNAM_UTC_OFFSET}`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}
