/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import { calendar } from "@/data/semester-2026-27-1";
import {
  holidayOn,
  isLectureDay,
  lastDayOf,
  periodOn,
  type SemesterCalendar,
  upcomingMilestones,
  validateCalendar,
  weekNumberOn,
} from "./calendar";

describe("seed calendar", () => {
  it("passes structural validation", () => {
    expect(validateCalendar(calendar)).toEqual([]);
  });

  it("ends on the last day of the final break", () => {
    expect(lastDayOf(calendar)).toBe("2027-03-21");
  });
});

describe("validateCalendar", () => {
  const base: SemesterCalendar = {
    session: "test",
    firstLectureDay: "2026-10-12",
    periods: [
      { id: "a", name: "A", kind: "lectures", start: "2026-10-12", end: "2026-10-20" },
      { id: "b", name: "B", kind: "break", start: "2026-10-18", end: "2026-10-25" },
    ],
    holidays: [],
  };

  it("detects overlapping periods", () => {
    expect(validateCalendar(base)).toContain("a overlaps b");
  });

  it("detects a first lecture day that is not a Monday", () => {
    expect(validateCalendar({ ...base, firstLectureDay: "2026-10-13", periods: [] })).toContain(
      "firstLectureDay must be a Monday",
    );
  });

  it("detects duplicate holidays and reversed periods", () => {
    const problems = validateCalendar({
      ...base,
      periods: [{ id: "x", name: "X", kind: "lectures", start: "2026-10-20", end: "2026-10-12" }],
      holidays: [
        { date: "2026-11-09", name: "Deepavali", region: "all" },
        { date: "2026-11-09", name: "Deepavali", region: "all" },
      ],
    });
    expect(problems).toContain("x: start is after end");
    expect(problems).toContain("holiday Deepavali: duplicate entry");
  });
});

describe("week numbers", () => {
  it.each([
    ["2026-10-12", 1],
    ["2026-10-18", 1],
    ["2026-11-09", 5],
    ["2026-11-30", 8],
    ["2026-12-07", 9],
    ["2027-01-18", 15],
    ["2027-01-25", 16],
    ["2027-03-15", 23],
  ])("maps %s to week %i", (date, week) => {
    expect(weekNumberOn(calendar, date)).toBe(week);
  });

  it("is undefined before lectures start", () => {
    expect(weekNumberOn(calendar, "2026-10-09")).toBeUndefined();
  });
});

describe("periods and holidays", () => {
  it("identifies the period of a date", () => {
    expect(periodOn(calendar, "2026-10-04")?.kind).toBe("orientation");
    expect(periodOn(calendar, "2026-12-01")?.kind).toBe("break");
    expect(periodOn(calendar, "2027-02-05")?.kind).toBe("exams");
    expect(periodOn(calendar, "2027-04-01")).toBeUndefined();
  });

  it("applies region-specific holidays by campus", () => {
    expect(holidayOn(calendar, "2027-01-22", "KL")).toBeUndefined();
    expect(holidayOn(calendar, "2027-01-22", "Johor")?.name).toBe("Thaipusam");
    expect(holidayOn(calendar, "2027-01-01", "KL")?.name).toBe("New Year's Day");
    expect(holidayOn(calendar, "2027-01-01", "Johor")).toBeUndefined();
    expect(holidayOn(calendar, "2026-11-09", "Johor")?.name).toBe("Deepavali");
  });

  it("treats only weekdays in lecture periods without holidays as lecture days", () => {
    expect(isLectureDay(calendar, "2026-11-10", "KL")).toBe(true);
    expect(isLectureDay(calendar, "2026-11-09", "KL")).toBe(false);
    expect(isLectureDay(calendar, "2026-10-17", "KL")).toBe(false);
    expect(isLectureDay(calendar, "2026-12-01", "KL")).toBe(false);
  });
});

describe("milestones", () => {
  it("lists upcoming period starts with day counts", () => {
    expect(upcomingMilestones(calendar, "2026-10-04", 2)).toEqual([
      { label: "Lectures (first half)", date: "2026-10-12", daysUntil: 8, kind: "lectures" },
      { label: "Mid-semester break", date: "2026-11-30", daysUntil: 57, kind: "break" },
    ]);
  });

  it("returns nothing after the final period starts", () => {
    expect(upcomingMilestones(calendar, "2027-03-01", 3)).toEqual([]);
  });
});
