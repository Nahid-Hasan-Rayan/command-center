/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import {
  type Campus,
  holidayOn,
  lastDayOf,
  type Period,
  periodOn,
  type SemesterCalendar,
  weekNumberOn,
} from "./calendar";
import { addDays, compareDates, diffDays, eachDay, type LocalDate, startOfWeek } from "./time";
import { type SlotTemplate, sessionsBetween } from "./timetable";

export interface WeekSummary {
  number: number;
  start: LocalDate;
  end: LocalDate;
  periods: Period[];
  heldSessions: number;
  cancelledSessions: number;
  holidays: { date: LocalDate; name: string }[];
}

export function buildWeekSummaries(
  calendar: SemesterCalendar,
  timetable: SlotTemplate[],
  campus: Campus,
): WeekSummary[] {
  const first = startOfWeek(calendar.firstLectureDay);
  const last = lastDayOf(calendar);
  const count = Math.floor(diffDays(last, first) / 7) + 1;

  return Array.from({ length: count }, (_, index) => {
    const start = addDays(first, index * 7);
    const end = addDays(start, 6);
    const days = eachDay(start, end);
    const periods = calendar.periods.filter(
      (period) => compareDates(period.start, end) <= 0 && compareDates(period.end, start) >= 0,
    );
    const sessions = sessionsBetween(timetable, calendar, start, end, campus);
    const holidays = days.flatMap((date) => {
      const holiday = holidayOn(calendar, date, campus);
      return holiday ? [{ date, name: holiday.name }] : [];
    });
    return {
      number: weekNumberOn(calendar, start) ?? index + 1,
      start,
      end,
      periods,
      heldSessions: sessions.filter((session) => session.status === "scheduled").length,
      cancelledSessions: sessions.filter((session) => session.status === "cancelled").length,
      holidays,
    };
  });
}

export function lecturePhaseOf(calendar: SemesterCalendar, date: LocalDate): boolean {
  return periodOn(calendar, date)?.kind === "lectures";
}
