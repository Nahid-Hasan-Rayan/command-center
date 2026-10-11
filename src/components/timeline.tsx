/**
 * NHR
 * @author Nahid Hasan Rayan
 */

import { formatClock } from "@/domain/time";
import type { SessionView } from "@/domain/today";
import { courseColor } from "@/lib/colors";

interface TimelineProps {
  sessions: SessionView[];
  nowMinutes: number;
}

const WINDOW_MINUTES = 1440;
const TICK_COUNT = 8;

export function Timeline({ sessions, nowMinutes }: TimelineProps) {
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
    const offset = (index * WINDOW_MINUTES) / TICK_COUNT;
    return { offset, label: formatClock((nowMinutes + offset) % WINDOW_MINUTES) };
  });

  return (
    <div aria-hidden="true" className="select-none">
      <div className="relative h-14 overflow-hidden rounded-lg border border-border bg-surface-2">
        {ticks.map((tick) => (
          <span
            key={tick.offset}
            className="absolute inset-y-0 w-px bg-border"
            style={{ left: `${(tick.offset / WINDOW_MINUTES) * 100}%` }}
          />
        ))}
        {sessions.map((session) => {
          const start = Math.max(session.absoluteStart - nowMinutes, 0);
          const end = Math.min(session.absoluteEnd - nowMinutes, WINDOW_MINUTES);
          return (
            <span
              key={`${session.slotId}-${session.date}`}
              className="absolute top-2 bottom-2 flex items-center overflow-hidden rounded-md px-1.5 text-[11px] font-medium text-black"
              style={{
                left: `${(start / WINDOW_MINUTES) * 100}%`,
                width: `${((end - start) / WINDOW_MINUTES) * 100}%`,
                backgroundColor: courseColor(session.courseCode),
              }}
            >
              {session.courseShortName}
            </span>
          );
        })}
        <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted">
        {ticks.map((tick, index) => (
          <span
            key={tick.offset}
            className="absolute -translate-x-1/2"
            style={{
              left: `${(tick.offset / WINDOW_MINUTES) * 100}%`,
              transform:
                index === 0 ? "none" : index === TICK_COUNT ? "translateX(-100%)" : undefined,
            }}
          >
            {index === 0 ? "now" : tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
