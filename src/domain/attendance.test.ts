/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import { attendanceStatus, maxAbsences } from "./attendance";

describe("maxAbsences", () => {
  it.each([
    [27, 5],
    [13, 2],
    [28, 5],
    [26, 5],
    [14, 2],
    [4, 0],
    [5, 1],
    [0, 0],
  ])("allows floor of 20%% of %i sessions", (total, expected) => {
    expect(maxAbsences(total, 80)).toBe(expected);
  });

  it("scales with the minimum attendance requirement", () => {
    expect(maxAbsences(20, 100)).toBe(0);
    expect(maxAbsences(20, 75)).toBe(5);
  });

  it("rejects invalid inputs", () => {
    expect(() => maxAbsences(-1, 80)).toThrow(RangeError);
    expect(() => maxAbsences(10, 101)).toThrow(RangeError);
  });
});

describe("attendanceStatus", () => {
  it("is safe with comfortable headroom", () => {
    expect(attendanceStatus(27, 0)).toEqual({
      totalSessions: 27,
      absences: 0,
      maxAbsences: 5,
      remaining: 5,
      state: "safe",
    });
  });

  it("warns when two or fewer absences remain", () => {
    expect(attendanceStatus(27, 3).state).toBe("watch");
    expect(attendanceStatus(27, 5).state).toBe("watch");
  });

  it("flags a breach once the limit is exceeded", () => {
    expect(attendanceStatus(27, 6)).toMatchObject({ remaining: -1, state: "breached" });
  });
});
