/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  activeDays,
  buildPlan,
  checkLoad,
  DEFAULT_SETTINGS,
  isRestDay,
  minutesByDay,
  nextActions,
  overallReadiness,
  paceFor,
  paperAverage,
  phaseOf,
  readiness,
  remainingUnits,
  reviewsDue,
  type StudyCourse,
  type StudySettings,
  streak,
  studyDaysBetween,
  urgency,
} from "./study-plan";

const TODAY = "2026-10-15"; // a Thursday

function course(overrides: Partial<StudyCourse> & { unitCount?: number } = {}): StudyCourse {
  const count = overrides.unitCount ?? 10;
  const id = overrides.id ?? "c1";
  return {
    id,
    code: overrides.code ?? "DSA",
    title: "Data Structures",
    weight: 1,
    examDate: null,
    units: Array.from({ length: count }, (_, index) => ({
      id: `${id}-u${index}`,
      topic: "T",
      title: `Unit ${index}`,
      position: index,
    })),
    doneOn: {},
    papers: [],
    recallAccuracy: null,
    ...overrides,
  };
}

describe("phases", () => {
  it("maps days left to the four phases", () => {
    expect(phaseOf(null)).toBeNull();
    expect(phaseOf(-1)?.label).toBe("Exam passed");
    expect(phaseOf(0)?.label).toBe("Exam day");
    expect(phaseOf(1)?.index).toBe(2);
    expect(phaseOf(3)?.index).toBe(2);
    expect(phaseOf(4)?.index).toBe(1);
    expect(phaseOf(14)?.index).toBe(1);
    expect(phaseOf(15)?.index).toBe(0);
  });
});

describe("rest days and study days", () => {
  const sundayOff: StudySettings = { ...DEFAULT_SETTINGS, restDays: [7] };

  it("recognises rest days by ISO weekday", () => {
    expect(isRestDay("2026-10-18", sundayOff)).toBe(true); // Sunday
    expect(isRestDay("2026-10-19", sundayOff)).toBe(false);
  });

  it("counts only study days in a range", () => {
    expect(studyDaysBetween("2026-10-12", "2026-10-19", DEFAULT_SETTINGS)).toBe(7);
    expect(studyDaysBetween("2026-10-12", "2026-10-19", sundayOff)).toBe(6);
    expect(studyDaysBetween("2026-10-12", "2026-10-12", sundayOff)).toBe(0);
  });
});

describe("readiness", () => {
  it("is zero with nothing done", () => {
    expect(readiness(course())).toBe(0);
  });

  it("uses mastery alone when there is no other data", () => {
    const c = course({ doneOn: { "c1-u0": TODAY, "c1-u1": TODAY } });
    expect(readiness(c)).toBeCloseTo(0.2);
  });

  it("blends mastery, recall and papers 50/20/30", () => {
    const c = course({
      doneOn: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`c1-u${i}`, TODAY])),
      recallAccuracy: 0.8,
      papers: [{ date: TODAY, scorePct: 60 }],
    });
    expect(readiness(c)).toBeCloseTo(0.5 * 0.5 + 0.8 * 0.2 + 0.6 * 0.3);
  });

  it("averages only the last three papers", () => {
    const c = course({
      papers: [
        { date: "2026-09-01", scorePct: 10 },
        { date: "2026-09-10", scorePct: 60 },
        { date: "2026-09-20", scorePct: 70 },
        { date: "2026-10-01", scorePct: 80 },
      ],
    });
    expect(paperAverage(c)).toBeCloseTo(0.7);
  });

  it("weights the overall figure by course weight and ignores empty courses", () => {
    const heavy = course({ id: "a", weight: 3, doneOn: { "a-u0": TODAY }, unitCount: 1 });
    const light = course({ id: "b", weight: 1, unitCount: 10 });
    const empty = course({ id: "c", unitCount: 0 });
    expect(overallReadiness([heavy, light, empty])).toBeCloseTo((1 * 3 + 0 * 1) / 4);
    expect(overallReadiness([])).toBe(0);
  });
});

describe("pace", () => {
  it("has no pace without a future exam date", () => {
    expect(paceFor(course(), TODAY, DEFAULT_SETTINGS)).toBeNull();
    expect(paceFor(course({ examDate: "2026-10-01" }), TODAY, DEFAULT_SETTINGS)).toBeNull();
  });

  it("spreads remaining units over the learning window, leaving 14 days for papers", () => {
    const c = course({ examDate: "2026-11-30", unitCount: 40 }); // 46 days away
    const pace = paceFor(c, TODAY, DEFAULT_SETTINGS);
    expect(pace?.studyDays).toBe(32); // 46 - 14
    expect(pace?.remaining).toBe(40);
    expect(pace?.unitsPerDay).toBeCloseTo(40 / 32);
    expect(pace?.minutesPerDay).toBeCloseTo((40 / 32) * 30);
  });

  it("uses the last 3 days as the only reserve once inside two weeks", () => {
    const c = course({ examDate: "2026-10-25", unitCount: 10 }); // 10 days away
    expect(paceFor(c, TODAY, DEFAULT_SETTINGS)?.studyDays).toBe(7);
  });

  it("never divides by zero on the last days", () => {
    const c = course({ examDate: "2026-10-16", unitCount: 4 });
    expect(paceFor(c, TODAY, DEFAULT_SETTINGS)?.studyDays).toBe(1);
  });

  it("needs more units per study day when rest days are taken", () => {
    const c = course({ examDate: "2026-11-30", unitCount: 40 });
    const weekdaysOnly: StudySettings = { ...DEFAULT_SETTINGS, restDays: [6, 7] };
    const open = paceFor(c, TODAY, DEFAULT_SETTINGS);
    const restricted = paceFor(c, TODAY, weekdaysOnly);
    expect(restricted?.unitsPerDay).toBeGreaterThan(open?.unitsPerDay ?? 0);
  });
});

describe("load across all courses", () => {
  it("is on track when needs fit comfortably inside the daily goal", () => {
    const c = course({ examDate: "2026-11-30", unitCount: 20 });
    expect(checkLoad([c], TODAY, DEFAULT_SETTINGS).load).toBe("on_track");
  });

  it("adds courses together because the hours are shared", () => {
    const a = course({ id: "a", code: "A", examDate: "2026-11-30", unitCount: 40 });
    const b = course({ id: "b", code: "B", examDate: "2026-11-30", unitCount: 40 });
    expect(checkLoad([a], TODAY, DEFAULT_SETTINGS).load).toBe("on_track"); // 37.5 of 90
    const both = checkLoad([a, b], TODAY, DEFAULT_SETTINGS);
    expect(both.neededMinutesPerDay).toBeCloseTo(75);
    expect(both.load).toBe("tight"); // 75 of 90 minutes is above 80%
    const triple = checkLoad(
      [a, b, course({ id: "c", code: "C", examDate: "2026-11-30", unitCount: 80 })],
      TODAY,
      DEFAULT_SETTINGS,
    );
    expect(triple.neededMinutesPerDay).toBeCloseTo(150);
    expect(triple.load).toBe("overloaded");
  });

  it("flags the course that drives the load and handles no deadlines", () => {
    const small = course({ id: "s", examDate: "2026-11-30", unitCount: 5 });
    const big = course({ id: "b", examDate: "2026-11-30", unitCount: 60 });
    expect(checkLoad([small, big], TODAY, DEFAULT_SETTINGS).heaviestCourseId).toBe("b");
    expect(checkLoad([course()], TODAY, DEFAULT_SETTINGS).load).toBe("no_deadline");
  });

  it("is overloaded when the daily goal is zero", () => {
    const c = course({ examDate: "2026-11-30" });
    expect(checkLoad([c], TODAY, { ...DEFAULT_SETTINGS, dailyGoalMin: 0 }).load).toBe("overloaded");
  });
});

describe("urgency", () => {
  it("ranks a near exam with work left above a far one", () => {
    const near = course({ id: "n", examDate: "2026-10-30" });
    const far = course({ id: "f", examDate: "2026-12-30" });
    expect(urgency(near, TODAY)).toBeGreaterThan(urgency(far, TODAY));
  });

  it("is zero after the exam and scales with weight", () => {
    expect(urgency(course({ examDate: "2026-10-01" }), TODAY)).toBe(0);
    const base = course({ examDate: "2026-11-30" });
    expect(urgency({ ...base, weight: 2 }, TODAY)).toBeCloseTo(urgency(base, TODAY) * 2);
  });
});

describe("streak and activity", () => {
  it("counts back from today, or yesterday when today is still empty", () => {
    const days = new Set(["2026-10-13", "2026-10-14", "2026-10-15"]);
    expect(streak(days, TODAY)).toBe(3);
    expect(streak(new Set(["2026-10-13", "2026-10-14"]), TODAY)).toBe(2);
    expect(streak(new Set(["2026-10-10"]), TODAY)).toBe(0);
    expect(streak(new Set(), TODAY)).toBe(0);
  });

  it("treats study minutes and finished units as activity", () => {
    const minutes = minutesByDay([
      { date: "2026-10-14", minutes: 30 },
      { date: "2026-10-14", minutes: 20 },
      { date: "2026-10-13", minutes: 0 },
    ]);
    expect(minutes.get("2026-10-14")).toBe(50);
    const c = course({ doneOn: { "c1-u0": "2026-10-12" } });
    const days = activeDays(minutes, [c]);
    expect(days.has("2026-10-14")).toBe(true);
    expect(days.has("2026-10-12")).toBe(true);
    expect(days.has("2026-10-13")).toBe(false);
  });
});

describe("spaced reviews", () => {
  it("queues units finished 1, 3, 7 or 14 days ago", () => {
    const c = course({
      doneOn: {
        "c1-u0": "2026-10-14", // 1 day ago
        "c1-u1": "2026-10-12", // 3 days ago
        "c1-u2": "2026-10-13", // 2 days ago: not due
        "c1-u3": "2026-10-01", // 14 days ago
      },
    });
    expect(reviewsDue(c, TODAY).map((unit) => unit.id)).toEqual(["c1-u3", "c1-u1", "c1-u0"]);
  });
});

describe("next actions", () => {
  it("continues the next unit when the exam is far", () => {
    const [first] = nextActions([course({ examDate: "2026-12-30" })], TODAY);
    expect(first?.kind).toBe("learn");
    expect(first?.title).toContain("Unit 0");
  });

  it("races the clock close to the exam with lots left, then switches to papers", () => {
    const racing = nextActions([course({ examDate: "2026-10-22", unitCount: 10 })], TODAY)[0];
    expect(racing?.title).toMatch(/Race the clock/);
    const almost = course({
      examDate: "2026-10-22",
      unitCount: 10,
      doneOn: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`c1-u${i}`, TODAY])),
    });
    expect(nextActions([almost], TODAY)[0]?.kind).toBe("paper");
  });

  it("goes deeper when everything is done and asks for a missing date", () => {
    const done = course({
      doneOn: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c1-u${i}`, TODAY])),
    });
    const kinds = nextActions([done], TODAY).map((action) => action.kind);
    expect(kinds).toContain("deeper");
    expect(kinds).toContain("set_date");
  });

  it("adds a spaced review and never returns more than four actions", () => {
    const c = course({ examDate: "2026-12-30", doneOn: { "c1-u0": "2026-10-14" } });
    const actions = nextActions([c, course({ id: "c2", code: "HCI" })], TODAY);
    expect(actions.some((action) => action.kind === "review")).toBe(true);
    expect(actions.length).toBeLessThanOrEqual(4);
  });

  it("returns nothing when every course is finished", () => {
    expect(nextActions([course({ examDate: "2026-10-01" })], TODAY)).toEqual([]);
  });
});

describe("plans", () => {
  const settings: StudySettings = { dailyGoalMin: 90, unitMinutes: 30, restDays: [7] };

  it("builds one entry per day with the right number of blocks and a rest day", () => {
    const plan = buildPlan([course({ examDate: "2026-12-30" })], settings, TODAY, 7);
    expect(plan).toHaveLength(7);
    expect(plan[0]?.date).toBe(TODAY);
    const sunday = plan.find((day) => day.date === "2026-10-18");
    expect(sunday?.rest).toBe(true);
    expect(sunday?.blocks).toEqual([]);
    expect(plan[0]?.blocks).toHaveLength(3);
  });

  it("never plans the same unit twice and goes through units in order", () => {
    const plan = buildPlan([course({ examDate: "2026-12-30", unitCount: 20 })], settings, TODAY, 6);
    const ids = plan.flatMap((day) =>
      day.blocks.filter((b) => b.kind === "learn").map((b) => b.unitId),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 3)).toEqual(["c1-u0", "c1-u1", "c1-u2"]);
  });

  it("interleaves courses by urgency", () => {
    const soon = course({ id: "a", code: "OS", examDate: "2026-10-30", unitCount: 20 });
    const later = course({ id: "b", code: "HCI", examDate: "2027-01-30", unitCount: 20 });
    const day = buildPlan([soon, later], settings, TODAY, 1)[0];
    const owners = day?.blocks.map((block) => block.courseId);
    expect(owners).toContain("a");
    expect(owners?.filter((id) => id === "a").length).toBeGreaterThan(
      owners?.filter((id) => id === "b").length ?? 0,
    );
  });

  it("puts a due review first and schedules reviews of what it plans", () => {
    const c = course({ examDate: "2026-12-30", unitCount: 20, doneOn: { "c1-u0": "2026-10-14" } });
    const plan = buildPlan([c], settings, TODAY, 3);
    expect(plan[0]?.blocks[0]?.kind).toBe("review");
    expect(plan[0]?.blocks[0]?.unitId).toBe("c1-u0");
    const learnedToday = plan[0]?.blocks.find((block) => block.kind === "learn")?.unitId;
    expect(plan[1]?.blocks.some((b) => b.kind === "review" && b.unitId === learnedToday)).toBe(
      true,
    );
  });

  it("switches to final revision and an exam marker around the exam", () => {
    const c = course({ examDate: "2026-10-17", unitCount: 4 });
    const plan = buildPlan([c], { ...settings, restDays: [] }, TODAY, 4);
    expect(plan[1]?.blocks.every((block) => block.kind === "revise")).toBe(true);
    const examDay = plan[2];
    expect(examDay?.blocks.some((block) => block.kind === "exam")).toBe(true);
    expect(examDay?.blocks.filter((block) => block.kind !== "exam")).toEqual([]);
    expect(plan[3]?.blocks).toEqual([]);
  });

  it("plans past papers once all units are done inside two weeks", () => {
    const done = Object.fromEntries(
      Array.from({ length: 4 }, (_, i) => [`c1-u${i}`, "2026-09-01"]),
    );
    const c = course({ examDate: "2026-10-25", unitCount: 4, doneOn: done });
    const plan = buildPlan([c], { ...settings, restDays: [] }, TODAY, 1);
    expect(plan[0]?.blocks.every((block) => block.kind === "paper")).toBe(true);
  });

  it("stays quiet for courses whose exam has passed and for no courses", () => {
    expect(buildPlan([], settings, TODAY, 3).every((day) => day.blocks.length === 0)).toBe(true);
    const past = course({ examDate: "2026-10-01" });
    expect(buildPlan([past], settings, TODAY, 2)[0]?.blocks).toEqual([]);
  });

  it("always plans at least one block when the goal is below one unit", () => {
    const tiny: StudySettings = { dailyGoalMin: 10, unitMinutes: 30, restDays: [] };
    expect(buildPlan([course({ examDate: "2026-12-30" })], tiny, TODAY, 1)[0]?.blocks).toHaveLength(
      1,
    );
  });
});

describe("helpers", () => {
  it("returns remaining units in order", () => {
    const c = course({ unitCount: 4, doneOn: { "c1-u1": TODAY } });
    expect(remainingUnits(c).map((unit) => unit.id)).toEqual(["c1-u0", "c1-u2", "c1-u3"]);
  });
});
