/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { addDays, compareDates, diffDays, isLocalDate, type LocalDate, weekdayOf } from "./time";

export type Campus = "KL" | "Johor";
export type HolidayRegion = "all" | Campus;
export type PeriodKind =
  | "orientation"
  | "lectures"
  | "break"
  | "revision"
  | "exams"
  | "final-break";

export interface Period {
  id: string;
  name: string;
  kind: PeriodKind;
  start: LocalDate;
  end: LocalDate;
}

export interface Holiday {
  date: LocalDate;
  name: string;
  region: HolidayRegion;
}

export interface SemesterCalendar {
  session: string;
  firstLectureDay: LocalDate;
  periods: Period[];
  holidays: Holiday[];
}

export interface Milestone {
  label: string;
  date: LocalDate;
  daysUntil: number;
  kind: PeriodKind;
}

export function validateCalendar(calendar: SemesterCalendar): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  for (const period of calendar.periods) {
    if (!isLocalDate(period.start) || !isLocalDate(period.end)) {
      problems.push(`${period.id}: invalid date`);
      continue;
    }
    if (compareDates(period.start, period.end) > 0) {
      problems.push(`${period.id}: start is after end`);
    }
    if (ids.has(period.id)) {
      problems.push(`${period.id}: duplicate id`);
    }
    ids.add(period.id);
  }

  const ordered = [...calendar.periods].sort((a, b) => compareDates(a.start, b.start));
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous && current && compareDates(current.start, previous.end) <= 0) {
      problems.push(`${previous.id} overlaps ${current.id}`);
    }
  }

  if (weekdayOf(calendar.firstLectureDay) !== 1) {
    problems.push("firstLectureDay must be a Monday");
  }

  const seen = new Set<string>();
  for (const holiday of calendar.holidays) {
    const key = `${holiday.date}|${holiday.region}|${holiday.name}`;
    if (!isLocalDate(holiday.date)) {
      problems.push(`holiday ${holiday.name}: invalid date`);
    }
    if (seen.has(key)) {
      problems.push(`holiday ${holiday.name}: duplicate entry`);
    }
    seen.add(key);
  }

  return problems;
}

export function periodOn(calendar: SemesterCalendar, date: LocalDate): Period | undefined {
  return calendar.periods.find(
    (period) => compareDates(date, period.start) >= 0 && compareDates(date, period.end) <= 0,
  );
}

export function weekNumberOn(calendar: SemesterCalendar, date: LocalDate): number | undefined {
  const offset = diffDays(date, calendar.firstLectureDay);
  return offset < 0 ? undefined : Math.floor(offset / 7) + 1;
}

export function holidayOn(
  calendar: SemesterCalendar,
  date: LocalDate,
  campus: Campus,
): Holiday | undefined {
  return calendar.holidays.find(
    (holiday) => holiday.date === date && (holiday.region === "all" || holiday.region === campus),
  );
}

export function isLectureDay(calendar: SemesterCalendar, date: LocalDate, campus: Campus): boolean {
  return (
    periodOn(calendar, date)?.kind === "lectures" &&
    weekdayOf(date) <= 5 &&
    holidayOn(calendar, date, campus) === undefined
  );
}

export function upcomingMilestones(
  calendar: SemesterCalendar,
  today: LocalDate,
  limit: number,
): Milestone[] {
  return calendar.periods
    .filter((period) => compareDates(period.start, today) > 0)
    .sort((a, b) => compareDates(a.start, b.start))
    .slice(0, limit)
    .map((period) => ({
      label: period.name,
      date: period.start,
      daysUntil: diffDays(period.start, today),
      kind: period.kind,
    }));
}

export function lastDayOf(calendar: SemesterCalendar): LocalDate {
  return calendar.periods.reduce(
    (latest, period) => (compareDates(period.end, latest) > 0 ? period.end : latest),
    addDays(calendar.firstLectureDay, 0),
  );
}
