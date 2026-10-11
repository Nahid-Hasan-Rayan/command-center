/**
 * NHR
 * @author Nahid Hasan Rayan
 */

export type LocalDate = string;
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ZonedNow {
  date: LocalDate;
  minutes: number;
}

const DAY_MS = 86_400_000;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function toUtcMs(date: LocalDate): number {
  const match = LOCAL_DATE_PATTERN.exec(date);
  if (!match) {
    throw new RangeError(`Invalid local date: ${date}`);
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(ms);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid local date: ${date}`);
  }
  return ms;
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isLocalDate(value: string): boolean {
  try {
    toUtcMs(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

export function diffDays(later: LocalDate, earlier: LocalDate): number {
  return Math.round((toUtcMs(later) - toUtcMs(earlier)) / DAY_MS);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return toUtcMs(a) - toUtcMs(b);
}

export function isWithin(date: LocalDate, start: LocalDate, end: LocalDate): boolean {
  const value = toUtcMs(date);
  return value >= toUtcMs(start) && value <= toUtcMs(end);
}

export function weekdayOf(date: LocalDate): Weekday {
  const day = new Date(toUtcMs(date)).getUTCDay();
  return (day === 0 ? 7 : day) as Weekday;
}

export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, 1 - weekdayOf(date));
}

export function eachDay(start: LocalDate, end: LocalDate): LocalDate[] {
  const length = diffDays(end, start);
  if (length < 0) {
    return [];
  }
  return Array.from({ length: length + 1 }, (_, offset) => addDays(start, offset));
}

export function parseClock(value: string): number {
  const match = CLOCK_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid clock time: ${value}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function zonedNow(instant: Date, timeZone: string): ZonedNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}
