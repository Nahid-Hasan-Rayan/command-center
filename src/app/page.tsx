/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { CalendarAccess } from "@/components/calendar-access";
import { Badge, Card } from "@/components/card";
import { SessionRow } from "@/components/session-row";
import { Timeline } from "@/components/timeline";
import { CAMPUS, TIME_ZONE } from "@/config";
import { calendar, courses, timetable } from "@/data/semester-2026-27-1";
import { DEFAULT_MIN_ATTENDANCE_PCT } from "@/domain/attendance";
import { attendanceBudgets } from "@/domain/attendance-budget";
import { buildToday } from "@/domain/today";
import {
  formatDayMonth,
  formatDaysUntil,
  formatLongDate,
  formatShortDate,
  periodLabel,
} from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Today" };

function TodayContent() {
  const today = buildToday({
    now: new Date(),
    timeZone: TIME_ZONE,
    campus: CAMPUS,
    calendar,
    timetable,
    courses,
  });
  const budgets = attendanceBudgets(
    calendar,
    timetable,
    courses,
    CAMPUS,
    DEFAULT_MIN_ATTENDANCE_PCT,
  );
  const cancelledToday = today.sessionsToday.filter((session) => session.state === "cancelled");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-muted">{formatLongDate(today.date)}</p>
        <div className="flex flex-wrap gap-2">
          {today.period ? <Badge tone="accent">{periodLabel[today.period.kind]}</Badge> : null}
          {today.weekNumber !== null && today.weekNumber > 0 ? (
            <Badge>Week {today.weekNumber}</Badge>
          ) : null}
        </div>
      </header>

      {cancelledToday.length > 0 ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-warn"
        >
          Classes are cancelled today: {cancelledToday[0]?.cancelReason}.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Next 24 hours">
            <Timeline sessions={today.next24Hours} nowMinutes={today.minutes} />
            {today.next24Hours.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No classes in the next 24 hours.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {today.next24Hours.map((session) => (
                  <SessionRow
                    key={`${session.slotId}-${session.date}`}
                    session={session}
                    showDate={
                      session.date === today.date ? undefined : formatShortDate(session.date)
                    }
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card title="Today's classes">
            {today.sessionsToday.length === 0 ? (
              <p className="text-sm text-muted">No classes today.</p>
            ) : (
              <ul className="space-y-2">
                {today.sessionsToday.map((session) => (
                  <SessionRow key={session.slotId} session={session} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Coming up">
            <ul className="space-y-2 text-sm">
              {today.milestones.map((milestone) => (
                <li key={milestone.label} className="flex items-baseline justify-between gap-2">
                  <span>{milestone.label}</span>
                  <span className="text-muted">
                    {formatDayMonth(milestone.date)} · {formatDaysUntil(milestone.daysUntil)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Lost sessions (next 14 days)">
            {today.lostSessions.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="space-y-2">
                {today.lostSessions.map((session) => (
                  <SessionRow
                    key={`${session.slotId}-${session.date}`}
                    session={session}
                    showDate={formatShortDate(session.date)}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card title="Absences allowed this semester">
            <ul className="space-y-1.5 text-sm">
              {budgets.map((budget) => (
                <li key={budget.courseCode} className="flex items-baseline justify-between">
                  <span>{budget.shortName}</span>
                  <span className="text-muted">
                    {budget.maxAbsences} of {budget.held} sessions
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Assumes {DEFAULT_MIN_ATTENDANCE_PCT}% attendance across every timetabled lecture and
              lab. Confirm the exact rule with each lecturer.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function TodayPage() {
  return (
    <CalendarAccess>
      <TodayContent />
    </CalendarAccess>
  );
}
