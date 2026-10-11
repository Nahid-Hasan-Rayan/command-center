/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import { calendar, courses, timetable } from "@/data/semester-2026-27-1";
import { buildToday, type TodayInput } from "./today";

const build = (iso: string, overrides: Partial<TodayInput> = {}) =>
  buildToday({
    now: new Date(iso),
    timeZone: "Asia/Kuala_Lumpur",
    campus: "KL",
    calendar,
    timetable,
    courses,
    ...overrides,
  });

describe("buildToday on the first lecture day", () => {
  const model = build("2026-10-12T02:30:00Z");

  it("reports date, week and phase", () => {
    expect(model.date).toBe("2026-10-12");
    expect(model.weekNumber).toBe(1);
    expect(model.period?.kind).toBe("lectures");
  });

  it("marks the running class as now and the later one as upcoming", () => {
    expect(model.sessionsToday.map((session) => [session.courseShortName, session.state])).toEqual([
      ["SPPM", "now"],
      ["DSA", "upcoming"],
    ]);
    expect(model.nextSession?.courseShortName).toBe("SPPM");
  });

  it("builds the next twenty-four hours across midnight", () => {
    expect(model.next24Hours.map((session) => session.courseCode)).toEqual([
      "SCSE2133",
      "SCSE2103",
      "SCSR2043",
      "SCSE2123",
    ]);
    expect(model.next24Hours[2]?.absoluteStart).toBe(1440 + 480);
  });
});

describe("buildToday before classes start", () => {
  const model = build("2026-10-04T04:00:00Z");

  it("has no sessions, no week number and counts down to lectures", () => {
    expect(model.period?.kind).toBe("orientation");
    expect(model.weekNumber).toBeNull();
    expect(model.sessionsToday).toEqual([]);
    expect(model.nextSession).toBeNull();
    expect(model.milestones[0]).toMatchObject({ kind: "lectures", daysUntil: 8 });
  });
});

describe("buildToday late in the day", () => {
  it("marks finished classes as done", () => {
    const model = build("2026-10-12T09:00:00Z");
    expect(model.sessionsToday.map((session) => session.state)).toEqual(["done", "done"]);
    expect(model.nextSession?.courseCode).toBe("SCSR2043");
  });
});

describe("buildToday lost sessions", () => {
  it("lists holiday-cancelled sessions in the next two weeks", () => {
    const model = build("2026-11-02T00:00:00Z");
    expect(model.lostSessions).toHaveLength(2);
    expect(model.lostSessions.every((session) => session.cancelReason === "Deepavali")).toBe(true);
    expect(model.lostSessions[0]?.date).toBe("2026-11-09");
  });

  it("shows none when no holidays fall in the window", () => {
    expect(build("2026-10-12T02:30:00Z").lostSessions).toEqual([]);
  });
});

describe("buildToday on a cancelled day", () => {
  it("keeps cancelled sessions out of the next twenty-four hours", () => {
    const model = build("2026-11-09T01:00:00Z");
    expect(model.sessionsToday.every((session) => session.state === "cancelled")).toBe(true);
    expect(model.next24Hours.every((session) => session.date !== "2026-11-09")).toBe(true);
  });
});
