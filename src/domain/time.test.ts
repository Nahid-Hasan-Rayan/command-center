/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  addDays,
  compareDates,
  diffDays,
  eachDay,
  formatClock,
  isLocalDate,
  isWithin,
  parseClock,
  startOfWeek,
  weekdayOf,
  zonedNow,
} from "./time";

describe("local date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("computes day differences in both directions", () => {
    expect(diffDays("2026-10-12", "2026-10-04")).toBe(8);
    expect(diffDays("2026-10-04", "2026-10-12")).toBe(-8);
  });

  it("returns ISO weekdays with Monday as 1 and Sunday as 7", () => {
    expect(weekdayOf("2026-10-12")).toBe(1);
    expect(weekdayOf("2026-10-04")).toBe(7);
    expect(weekdayOf("2026-12-25")).toBe(5);
  });

  it("finds the Monday that starts a week", () => {
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28");
    expect(startOfWeek("2026-10-14")).toBe("2026-10-12");
  });

  it("lists days inclusively and rejects reversed ranges", () => {
    expect(eachDay("2026-10-12", "2026-10-14")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(eachDay("2026-10-14", "2026-10-12")).toEqual([]);
  });

  it("compares and bounds dates", () => {
    expect(compareDates("2026-10-12", "2026-10-13")).toBeLessThan(0);
    expect(isWithin("2026-11-09", "2026-10-12", "2026-11-29")).toBe(true);
    expect(isWithin("2026-11-30", "2026-10-12", "2026-11-29")).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("12/10/2026")).toBe(false);
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
  });
});

describe("clock helpers", () => {
  it("parses and formats clock times", () => {
    expect(parseClock("10:00")).toBe(600);
    expect(parseClock("8:05")).toBe(485);
    expect(formatClock(765)).toBe("12:45");
    expect(formatClock(0)).toBe("00:00");
  });

  it("rejects malformed times", () => {
    expect(() => parseClock("25:00")).toThrow(RangeError);
    expect(() => parseClock("10:75")).toThrow(RangeError);
  });
});

describe("zonedNow", () => {
  it("converts an instant to Kuala Lumpur local date and minutes", () => {
    expect(zonedNow(new Date("2026-10-12T01:30:00Z"), "Asia/Kuala_Lumpur")).toEqual({
      date: "2026-10-12",
      minutes: 570,
    });
  });

  it("rolls the date forward across the UTC boundary", () => {
    expect(zonedNow(new Date("2026-10-11T17:00:00Z"), "Asia/Kuala_Lumpur")).toEqual({
      date: "2026-10-12",
      minutes: 60,
    });
  });

  it("reports local midnight as zero minutes", () => {
    expect(zonedNow(new Date("2026-10-11T16:00:00Z"), "Asia/Kuala_Lumpur")).toEqual({
      date: "2026-10-12",
      minutes: 0,
    });
  });
});
