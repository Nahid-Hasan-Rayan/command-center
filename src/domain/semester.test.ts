/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import { calendar, timetable } from "@/data/semester-2026-27-1";
import { buildWeekSummaries } from "./semester";

describe("buildWeekSummaries", () => {
  const weeks = buildWeekSummaries(calendar, timetable, "KL");
  const week = (number: number) => weeks.find((entry) => entry.number === number);

  it("spans twenty-three weeks like the official calendar", () => {
    expect(weeks).toHaveLength(23);
    expect(weeks[0]?.start).toBe("2026-10-12");
    expect(weeks.at(-1)?.end).toBe("2027-03-21");
  });

  it("counts a normal teaching week", () => {
    expect(week(1)).toMatchObject({ heldSessions: 9, cancelledSessions: 0 });
  });

  it("loses Monday classes in the Deepavali week", () => {
    expect(week(5)).toMatchObject({ heldSessions: 7, cancelledSessions: 2 });
    expect(week(5)?.holidays.map((holiday) => holiday.name)).toEqual(["Deepavali"]);
  });

  it("loses the Friday lab in the Christmas and New Year weeks", () => {
    expect(week(11)).toMatchObject({ heldSessions: 8, cancelledSessions: 1 });
    expect(week(12)).toMatchObject({ heldSessions: 8, cancelledSessions: 1 });
  });

  it("has no classes during the break, revision and exams", () => {
    for (const number of [8, 16, 17, 18, 19]) {
      expect(week(number)).toMatchObject({ heldSessions: 0, cancelledSessions: 0 });
    }
  });
});
