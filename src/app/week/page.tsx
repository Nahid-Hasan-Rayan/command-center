/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarAccess } from "@/components/calendar-access";
import { Badge } from "@/components/card";
import { SessionRow } from "@/components/session-row";
import { CAMPUS, TIME_ZONE } from "@/config";
import { calendar, courses, timetable } from "@/data/semester-2026-27-1";
import { holidayOn, weekNumberOn } from "@/domain/calendar";
import { addDays, isLocalDate, startOfWeek, zonedNow } from "@/domain/time";
import { sessionsOn } from "@/domain/timetable";
import { formatDayMonth, formatShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Week" };

interface WeekPageProps {
  searchParams: Promise<{ date?: string }>;
}

async function WeekContent({ searchParams }: WeekPageProps) {
  const { date: requested } = await searchParams;
  const today = zonedNow(new Date(), TIME_ZONE).date;
  const anchor = requested && isLocalDate(requested) ? requested : today;
  const monday = startOfWeek(anchor);
  const days = Array.from({ length: 5 }, (_, index) => addDays(monday, index));
  const weekNumber = weekNumberOn(calendar, monday);
  const coursesByCode = new Map(courses.map((course) => [course.code, course]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Week</h1>
          <p className="text-muted">
            {formatDayMonth(monday)} – {formatDayMonth(addDays(monday, 6))}
            {weekNumber !== undefined && weekNumber > 0 ? ` · Week ${weekNumber}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2"
            href={`/week?date=${addDays(monday, -7)}`}
          >
            Previous
          </Link>
          <Link
            className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2"
            href="/week"
          >
            This week
          </Link>
          <Link
            className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2"
            href={`/week?date=${addDays(monday, 7)}`}
          >
            Next
          </Link>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-5">
        {days.map((day) => {
          const sessions = sessionsOn(timetable, calendar, day, CAMPUS).map((session) => ({
            ...session,
            courseShortName: coursesByCode.get(session.courseCode)?.shortName ?? session.courseCode,
          }));
          const holiday = holidayOn(calendar, day, CAMPUS);
          return (
            <section
              key={day}
              aria-label={formatShortDate(day)}
              className={`rounded-xl border bg-surface p-3 ${day === today ? "border-accent" : "border-border"}`}
            >
              <h2 className="mb-2 text-sm font-medium">{formatShortDate(day)}</h2>
              {holiday ? <Badge tone="warn">{holiday.name}</Badge> : null}
              {sessions.length === 0 && !holiday ? (
                <p className="text-sm text-muted">No classes.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {sessions.map((session) => (
                    <SessionRow key={session.slotId} session={session} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function WeekPage(props: WeekPageProps) {
  return (
    <CalendarAccess>
      <WeekContent {...props} />
    </CalendarAccess>
  );
}
