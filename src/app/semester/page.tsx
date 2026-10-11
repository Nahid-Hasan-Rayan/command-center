/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { CalendarAccess } from "@/components/calendar-access";
import { Badge } from "@/components/card";
import { CAMPUS, TIME_ZONE } from "@/config";
import { calendar, timetable } from "@/data/semester-2026-27-1";
import { buildWeekSummaries } from "@/domain/semester";
import { isWithin, zonedNow } from "@/domain/time";
import { formatDayMonth, periodLabel } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Semester" };

function SemesterContent() {
  const today = zonedNow(new Date(), TIME_ZONE).date;
  const weeks = buildWeekSummaries(calendar, timetable, CAMPUS);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Semester {calendar.session}</h1>
        <p className="text-muted">Official UTM calendar, KL campus.</p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <caption className="sr-only">Week-by-week semester overview</caption>
          <thead className="bg-surface-2 text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Week
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Dates
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Phase
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Classes
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => {
              const current = isWithin(today, week.start, week.end);
              return (
                <tr
                  key={week.number}
                  aria-current={current ? "date" : undefined}
                  className={`border-t border-border ${current ? "bg-surface-2" : "bg-surface"}`}
                >
                  <th scope="row" className="px-3 py-2 font-medium">
                    {week.number}
                  </th>
                  <td className="px-3 py-2 text-muted">
                    {formatDayMonth(week.start)} – {formatDayMonth(week.end)}
                  </td>
                  <td className="px-3 py-2">
                    {week.periods.map((period) => periodLabel[period.kind]).join(" / ")}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {week.heldSessions > 0 || week.cancelledSessions > 0
                      ? `${week.heldSessions} held`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {week.holidays.map((holiday) => (
                        <Badge key={holiday.date} tone="warn">
                          {holiday.name}
                        </Badge>
                      ))}
                      {week.cancelledSessions > 0 ? (
                        <Badge tone="warn">{week.cancelledSessions} lost</Badge>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SemesterPage() {
  return (
    <CalendarAccess>
      <SemesterContent />
    </CalendarAccess>
  );
}
