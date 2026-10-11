/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { type Campus, holidayOn, periodOn, type SemesterCalendar } from "./calendar";
import { eachDay, type LocalDate, parseClock, type Weekday, weekdayOf } from "./time";

export type SessionKind = "lecture" | "lab";
export type SessionStatus = "scheduled" | "cancelled";

export interface Course {
  code: string;
  name: string;
  shortName: string;
  credits: number;
  section: string;
}

export interface SlotTemplate {
  id: string;
  day: 1 | 2 | 3 | 4 | 5;
  start: string;
  end: string;
  courseCode: string;
  kind: SessionKind;
  room: string;
  lecturer?: string;
}

export interface Session {
  slotId: string;
  courseCode: string;
  kind: SessionKind;
  room: string;
  lecturer?: string;
  date: LocalDate;
  startMinutes: number;
  endMinutes: number;
  status: SessionStatus;
  cancelReason?: string;
}

export interface SessionCount {
  scheduled: number;
  held: number;
  cancelled: number;
}

export function validateTimetable(slots: SlotTemplate[], courses: Course[]): string[] {
  const problems: string[] = [];
  const codes = new Set(courses.map((course) => course.code));
  const ids = new Set<string>();

  for (const slot of slots) {
    if (ids.has(slot.id)) {
      problems.push(`${slot.id}: duplicate id`);
    }
    ids.add(slot.id);
    if (!codes.has(slot.courseCode)) {
      problems.push(`${slot.id}: unknown course ${slot.courseCode}`);
    }
    if (parseClock(slot.start) >= parseClock(slot.end)) {
      problems.push(`${slot.id}: start is not before end`);
    }
  }

  for (const [index, first] of slots.entries()) {
    for (const second of slots.slice(index + 1)) {
      const overlap =
        first.day === second.day &&
        parseClock(first.start) < parseClock(second.end) &&
        parseClock(second.start) < parseClock(first.end);
      if (overlap) {
        problems.push(`${first.id} overlaps ${second.id}`);
      }
    }
  }

  return problems;
}

export function sessionsOn(
  slots: SlotTemplate[],
  calendar: SemesterCalendar,
  date: LocalDate,
  campus: Campus,
): Session[] {
  if (periodOn(calendar, date)?.kind !== "lectures") {
    return [];
  }
  const weekday: Weekday = weekdayOf(date);
  if (weekday > 5) {
    return [];
  }
  const holiday = holidayOn(calendar, date, campus);

  return slots
    .filter((slot) => slot.day === weekday)
    .map((slot): Session => {
      const base = {
        slotId: slot.id,
        courseCode: slot.courseCode,
        kind: slot.kind,
        room: slot.room,
        date,
        startMinutes: parseClock(slot.start),
        endMinutes: parseClock(slot.end),
      };
      const withLecturer = slot.lecturer ? { ...base, lecturer: slot.lecturer } : base;
      return holiday
        ? { ...withLecturer, status: "cancelled", cancelReason: holiday.name }
        : { ...withLecturer, status: "scheduled" };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export function sessionsBetween(
  slots: SlotTemplate[],
  calendar: SemesterCalendar,
  start: LocalDate,
  end: LocalDate,
  campus: Campus,
): Session[] {
  return eachDay(start, end).flatMap((date) => sessionsOn(slots, calendar, date, campus));
}

export function countSessions(
  slots: SlotTemplate[],
  calendar: SemesterCalendar,
  courseCode: string,
  campus: Campus,
  start: LocalDate,
  end: LocalDate,
  kinds: SessionKind[] = ["lecture", "lab"],
): SessionCount {
  const sessions = sessionsBetween(slots, calendar, start, end, campus).filter(
    (session) => session.courseCode === courseCode && kinds.includes(session.kind),
  );
  const cancelled = sessions.filter((session) => session.status === "cancelled").length;
  return { scheduled: sessions.length, held: sessions.length - cancelled, cancelled };
}
