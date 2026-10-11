/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import { calendar, courses, timetable } from "@/data/semester-2026-27-1";
import { attendanceBudgets } from "./attendance-budget";

describe("attendanceBudgets", () => {
  it("derives held sessions and allowed absences per course", () => {
    const budgets = attendanceBudgets(calendar, timetable, courses, "KL", 80);
    const byShortName = Object.fromEntries(budgets.map((budget) => [budget.shortName, budget]));

    expect(byShortName.DSA).toMatchObject({ held: 27, cancelled: 1, maxAbsences: 5 });
    expect(byShortName.SPPM).toMatchObject({ held: 13, cancelled: 1, maxAbsences: 2 });
    expect(byShortName.OS).toMatchObject({ held: 28, cancelled: 0, maxAbsences: 5 });
    expect(byShortName.SRE).toMatchObject({ held: 14, maxAbsences: 2 });
    expect(byShortName.HCI).toMatchObject({ held: 26, cancelled: 2, maxAbsences: 5 });
    expect(byShortName.Drone).toMatchObject({ held: 14, maxAbsences: 2 });
  });

  it("returns nothing without lecture periods", () => {
    expect(attendanceBudgets({ ...calendar, periods: [] }, timetable, courses, "KL", 80)).toEqual(
      [],
    );
  });
});
