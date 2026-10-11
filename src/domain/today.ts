/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import {
  type Campus,
  type Milestone,
  type Period,
  periodOn,
  type SemesterCalendar,
  upcomingMilestones,
  weekNumberOn,
} from "./calendar";
import { addDays, diffDays, type LocalDate, weekdayOf, zonedNow } from "./time";
import {
  type Course,
  type Session,
  type SlotTemplate,
  sessionsBetween,
  sessionsOn,
} from "./timetable";

export type SessionState = "done" | "now" | "upcoming" | "cancelled";

export interface SessionView extends Session {
  courseName: string;
  courseShortName: string;
  state: SessionState;
  absoluteStart: number;
  absoluteEnd: number;
}

export interface TodayModel {
  date: LocalDate;
  weekday: number;
  minutes: number;
  period: Period | null;
  weekNumber: number | null;
  sessionsToday: SessionView[];
  nextSession: SessionView | null;
  next24Hours: SessionView[];
  lostSessions: SessionView[];
  milestones: Milestone[];
}

export interface TodayInput {
  now: Date;
  timeZone: string;
  campus: Campus;
  calendar: SemesterCalendar;
  timetable: SlotTemplate[];
  courses: Course[];
}

const MINUTES_PER_DAY = 1440;
const LOST_SESSION_HORIZON_DAYS = 14;
const MILESTONE_LIMIT = 3;

function toView(
  session: Session,
  coursesByCode: Map<string, Course>,
  today: LocalDate,
  nowMinutes: number,
): SessionView {
  const course = coursesByCode.get(session.courseCode);
  const dayOffset = diffDays(session.date, today);
  const state: SessionState =
    session.status === "cancelled"
      ? "cancelled"
      : dayOffset > 0 || session.startMinutes > nowMinutes
        ? "upcoming"
        : session.endMinutes > nowMinutes
          ? "now"
          : "done";
  return {
    ...session,
    courseName: course?.name ?? session.courseCode,
    courseShortName: course?.shortName ?? session.courseCode,
    state,
    absoluteStart: dayOffset * MINUTES_PER_DAY + session.startMinutes,
    absoluteEnd: dayOffset * MINUTES_PER_DAY + session.endMinutes,
  };
}

export function buildToday(input: TodayInput): TodayModel {
  const { date, minutes } = zonedNow(input.now, input.timeZone);
  const coursesByCode = new Map(input.courses.map((course) => [course.code, course]));

  const sessionsToday = sessionsOn(input.timetable, input.calendar, date, input.campus).map(
    (session) => toView(session, coursesByCode, date, minutes),
  );

  const window: SessionView[] = [0, 1, 2].flatMap((offset) =>
    sessionsOn(input.timetable, input.calendar, addDays(date, offset), input.campus)
      .filter((session) => session.status === "scheduled")
      .map((session) => toView(session, coursesByCode, date, minutes)),
  );

  const next24Hours = window.filter(
    (session) => session.absoluteEnd > minutes && session.absoluteStart < minutes + MINUTES_PER_DAY,
  );

  const lostSessions = sessionsBetween(
    input.timetable,
    input.calendar,
    date,
    addDays(date, LOST_SESSION_HORIZON_DAYS),
    input.campus,
  )
    .filter((session) => session.status === "cancelled")
    .map((session) => toView(session, coursesByCode, date, minutes));

  const nextSession =
    window.find((session) => session.state === "now" || session.absoluteStart > minutes) ?? null;

  return {
    date,
    weekday: weekdayOf(date),
    minutes,
    period: periodOn(input.calendar, date) ?? null,
    weekNumber: weekNumberOn(input.calendar, date) ?? null,
    sessionsToday,
    nextSession,
    next24Hours,
    lostSessions,
    milestones: upcomingMilestones(input.calendar, date, MILESTONE_LIMIT),
  };
}
