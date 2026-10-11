/**
 * NHR
 * @author Nahid Hasan Rayan
 */

export interface AttendanceStatus {
  totalSessions: number;
  absences: number;
  maxAbsences: number;
  remaining: number;
  state: "safe" | "watch" | "breached";
}

export const DEFAULT_MIN_ATTENDANCE_PCT = 80;
const WATCH_THRESHOLD = 2;

export function maxAbsences(totalSessions: number, minAttendancePct: number): number {
  if (totalSessions < 0 || minAttendancePct < 0 || minAttendancePct > 100) {
    throw new RangeError("Invalid attendance inputs");
  }
  return Math.floor((totalSessions * (100 - minAttendancePct)) / 100);
}

export function attendanceStatus(
  totalSessions: number,
  absences: number,
  minAttendancePct: number = DEFAULT_MIN_ATTENDANCE_PCT,
): AttendanceStatus {
  const allowed = maxAbsences(totalSessions, minAttendancePct);
  const remaining = allowed - absences;
  const state = remaining < 0 ? "breached" : remaining <= WATCH_THRESHOLD ? "watch" : "safe";
  return { totalSessions, absences, maxAbsences: allowed, remaining, state };
}
