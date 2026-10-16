/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { logTimerSessionAction } from "./actions";

interface CourseOption {
  id: string;
  code: string;
}

const pad = (value: number): string => String(value).padStart(2, "0");
const clock = (seconds: number): string => `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;

function beep(): void {
  try {
    const context = new AudioContext();
    for (const offset of [0, 0.25, 0.5]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.15);
    }
  } catch {
    // Sound is a nicety. The timer works without it.
  }
}

export function FocusTimer({ courses }: { courses: CourseOption[] }) {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60);
  const [courseId, setCourseId] = useState("");
  const [message, setMessage] = useState("");
  const [, startTransition] = useTransition();
  const endsAt = useRef(0);

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0) {
        return;
      }
      window.clearInterval(timer);
      setRunning(false);
      beep();
      if (mode === "focus") {
        startTransition(async () => {
          const result = await logTimerSessionAction(courseId, focusMinutes);
          setMessage(
            result.ok
              ? `${focusMinutes} minutes logged.`
              : "Could not save the session. Log it by hand.",
          );
        });
        setMode("break");
        setRemaining(breakMinutes * 60);
      } else {
        setMessage("Break over. Ready for the next block.");
        setMode("focus");
        setRemaining(focusMinutes * 60);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [running, mode, courseId, focusMinutes, breakMinutes]);

  useEffect(() => {
    document.title = running
      ? `${clock(remaining)} ${mode === "focus" ? "Focus" : "Break"}`
      : "Study";
  }, [running, remaining, mode]);

  function toggle(): void {
    if (running) {
      setRunning(false);
      return;
    }
    endsAt.current = Date.now() + remaining * 1000;
    setMessage("");
    setRunning(true);
  }

  function reset(): void {
    setRunning(false);
    setMode("focus");
    setRemaining(focusMinutes * 60);
  }

  function preset(focus: number, rest: number): void {
    setRunning(false);
    setFocusMinutes(focus);
    setBreakMinutes(rest);
    setMode("focus");
    setRemaining(focus * 60);
  }

  return (
    <div className="space-y-3">
      <p
        className="text-center text-5xl font-semibold tabular-nums"
        aria-live="off"
        role="timer"
        aria-label={`${mode === "focus" ? "Focus" : "Break"} time left`}
      >
        {clock(remaining)}
      </p>
      <p className="text-center text-sm text-muted">{mode === "focus" ? "Focus" : "Break"}</p>
      <div className="flex flex-wrap items-end justify-center gap-3">
        <label className="text-sm">
          <span className="block text-xs text-muted">Course</span>
          <select
            className={inputClass}
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            disabled={running}
          >
            <option value="">No course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={buttonClass("primary")} onClick={toggle}>
          {running ? "Pause" : "Start"}
        </button>
        <button type="button" className={buttonClass("quiet")} onClick={reset}>
          Reset
        </button>
        {[
          [25, 5],
          [50, 10],
          [90, 15],
        ].map(([focus, rest]) => (
          <button
            key={`${focus}-${rest}`}
            type="button"
            className={buttonClass("quiet")}
            onClick={() => preset(focus as number, rest as number)}
            disabled={running}
          >
            {focus}/{rest}
          </button>
        ))}
      </div>
      <p className="min-h-5 text-center text-sm text-muted" aria-live="polite">
        {message || "A finished focus session is logged to the chosen course."}
      </p>
    </div>
  );
}
