/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { maxAbsences } from "./attendance";
import type { Campus, SemesterCalendar } from "./calendar";
import { compareDates, type LocalDate } from "./time";
import { type Course, countSessions, type SlotTemplate } from "./timetable";

export interface AttendanceBudget {
  courseCode: string;
  shortName: string;
  held: number;
  cancelled: number;
  maxAbsences: number;
}

function lectureSpan(calendar: SemesterCalendar): { start: LocalDate; end: LocalDate } | null {
  const lectures = calendar.periods.filter((period) => period.kind === "lectures");
  const first = lectures.reduce<LocalDate | null>(
    (min, period) => (min === null || compareDates(period.start, min) < 0 ? period.start : min),
    null,
  );
  const last = lectures.reduce<LocalDate | null>(
    (max, period) => (max === null || compareDates(period.end, max) > 0 ? period.end : max),
    null,
  );
  return first && last ? { start: first, end: last } : null;
}

export function attendanceBudgets(
  calendar: SemesterCalendar,
  timetable: SlotTemplate[],
  courses: Course[],
  campus: Campus,
  minAttendancePct: number,
): AttendanceBudget[] {
  const span = lectureSpan(calendar);
  if (!span) {
    return [];
  }
  return courses.map((course) => {
    const { held, cancelled } = countSessions(
      timetable,
      calendar,
      course.code,
      campus,
      span.start,
      span.end,
    );
    return {
      courseCode: course.code,
      shortName: course.shortName,
      held,
      cancelled,
      maxAbsences: maxAbsences(held, minAttendancePct),
    };
  });
}
