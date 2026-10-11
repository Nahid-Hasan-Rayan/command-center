/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import { calendar, courses, timetable } from "@/data/semester-2026-27-1";
import { countSessions, type SlotTemplate, sessionsOn, validateTimetable } from "./timetable";

const FIRST = "2026-10-12";
const LAST_LECTURE = "2027-01-24";

describe("seed timetable", () => {
  it("passes validation", () => {
    expect(validateTimetable(timetable, courses)).toEqual([]);
  });

  it("totals twenty one-hour slots per week", () => {
    const slots = timetable.reduce((sum, slot) => {
      const [startH, startM] = slot.start.split(":").map(Number);
      const [endH, endM] = slot.end.split(":").map(Number);
      const minutes = (endH ?? 0) * 60 + (endM ?? 0) - ((startH ?? 0) * 60 + (startM ?? 0));
      return sum + Math.round(minutes / 60);
    }, 0);
    expect(slots).toBe(20);
  });
});

describe("validateTimetable", () => {
  const slot: SlotTemplate = {
    id: "a",
    day: 1,
    start: "10:00",
    end: "11:00",
    courseCode: "SCSE2103",
    kind: "lecture",
    room: "BK 1",
  };

  it("reports unknown courses, overlaps and bad time ranges", () => {
    const problems = validateTimetable(
      [
        slot,
        { ...slot, id: "b", start: "10:30", end: "11:30" },
        { ...slot, id: "c", courseCode: "NOPE0000", day: 2 },
        { ...slot, id: "d", day: 3, start: "12:00", end: "11:00" },
      ],
      courses,
    );
    expect(problems).toContain("a overlaps b");
    expect(problems).toContain("c: unknown course NOPE0000");
    expect(problems).toContain("d: start is not before end");
  });
});

describe("sessionsOn", () => {
  it("returns Monday sessions in time order", () => {
    const sessions = sessionsOn(timetable, calendar, "2026-10-12", "KL");
    expect(sessions.map((session) => session.courseCode)).toEqual(["SCSE2133", "SCSE2103"]);
    expect(sessions.every((session) => session.status === "scheduled")).toBe(true);
    expect(sessions[0]?.startMinutes).toBe(600);
    expect(sessions[0]?.endMinutes).toBe(770);
  });

  it("returns no sessions outside lecture periods or on weekends", () => {
    expect(sessionsOn(timetable, calendar, "2026-10-10", "KL")).toEqual([]);
    expect(sessionsOn(timetable, calendar, "2026-10-17", "KL")).toEqual([]);
    expect(sessionsOn(timetable, calendar, "2026-12-01", "KL")).toEqual([]);
    expect(sessionsOn(timetable, calendar, "2027-02-02", "KL")).toEqual([]);
  });

  it("cancels sessions on public holidays and records the reason", () => {
    const monday = sessionsOn(timetable, calendar, "2026-11-09", "KL");
    expect(monday).toHaveLength(2);
    expect(monday.every((session) => session.status === "cancelled")).toBe(true);
    expect(monday[0]?.cancelReason).toBe("Deepavali");

    const christmas = sessionsOn(timetable, calendar, "2026-12-25", "KL");
    expect(christmas.map((session) => [session.courseCode, session.status])).toEqual([
      ["SCSM2113", "cancelled"],
    ]);
  });

  it("applies campus-specific holidays only to that campus", () => {
    expect(sessionsOn(timetable, calendar, "2027-01-01", "KL")[0]?.status).toBe("cancelled");
    expect(sessionsOn(timetable, calendar, "2027-01-01", "Johor")[0]?.status).toBe("scheduled");
    expect(sessionsOn(timetable, calendar, "2027-01-22", "KL")[0]?.status).toBe("scheduled");
  });
});

describe("countSessions", () => {
  it("counts held and cancelled sessions per course across the lecture weeks", () => {
    const count = (code: string, kinds?: ("lecture" | "lab")[]) =>
      countSessions(timetable, calendar, code, "KL", FIRST, LAST_LECTURE, kinds);

    expect(count("SCSE2133")).toEqual({ scheduled: 14, held: 13, cancelled: 1 });
    expect(count("SCSE2103", ["lecture"])).toEqual({ scheduled: 14, held: 13, cancelled: 1 });
    expect(count("SCSE2103", ["lab"])).toEqual({ scheduled: 14, held: 14, cancelled: 0 });
    expect(count("SCSM2113", ["lab"])).toEqual({ scheduled: 14, held: 12, cancelled: 2 });
    expect(count("SCSM2113", ["lecture"])).toEqual({ scheduled: 14, held: 14, cancelled: 0 });
    expect(count("SCSR2043")).toEqual({ scheduled: 28, held: 28, cancelled: 0 });
    expect(count("SCSE2123")).toEqual({ scheduled: 14, held: 14, cancelled: 0 });
    expect(count("ULRF2182")).toEqual({ scheduled: 14, held: 14, cancelled: 0 });
  });
});
