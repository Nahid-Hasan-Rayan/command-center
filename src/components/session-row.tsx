/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Session } from "@/domain/timetable";
import { courseColor } from "@/lib/colors";
import { formatRange } from "@/lib/format";
import { Badge } from "./card";

interface SessionRowProps {
  session: Session & { courseShortName: string; courseName?: string; state?: string };
  showDate?: string;
}

const kindLabel = { lecture: "Lecture", lab: "Lab" } as const;

export function SessionRow({ session, showDate }: SessionRowProps) {
  const cancelled = session.status === "cancelled";
  const done = session.state === "done";

  return (
    <li
      className={`flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 ${
        cancelled || done ? "opacity-60" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: courseColor(session.courseCode) }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`font-medium ${cancelled ? "line-through" : ""}`}>
            {session.courseShortName}
          </span>
          <span className="text-sm text-muted">{kindLabel[session.kind]}</span>
          {session.state === "now" ? <Badge tone="accent">In progress</Badge> : null}
          {cancelled ? <Badge tone="warn">{session.cancelReason ?? "Cancelled"}</Badge> : null}
        </div>
        <p className="text-sm text-muted">
          {showDate ? `${showDate} · ` : ""}
          {formatRange(session.startMinutes, session.endMinutes)} · {session.room}
        </p>
      </div>
    </li>
  );
}
