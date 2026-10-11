/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  type Assessment,
  marksAtStake,
  requiredMarks,
  totalWeight,
  weightsAreComplete,
} from "./grading";

const sppm: Assessment[] = [
  { id: "quiz", title: "Quiz 1", kind: "quiz", weight: 5, dueDate: "2026-11-02" },
  { id: "a1", title: "Assignment 1", kind: "assignment", weight: 15, dueDate: "2026-11-16" },
  { id: "a2", title: "Assignment 2", kind: "assignment", weight: 10, dueDate: "2026-12-07" },
  { id: "a3", title: "Assignment 3", kind: "assignment", weight: 15, dueDate: "2026-12-28" },
  { id: "a4", title: "Assignment 4", kind: "assignment", weight: 10, dueDate: "2027-01-11" },
  { id: "mid", title: "Midterm", kind: "midterm", weight: 15, dueDate: "2026-11-23" },
  { id: "final", title: "Final", kind: "final", weight: 30 },
];

const rule = { continuousMinPct: 30, finalMinPct: 20, overallMinPct: 40 };

describe("weights", () => {
  it("sums to one hundred for a complete outline", () => {
    expect(totalWeight(sppm)).toBe(100);
    expect(weightsAreComplete(sppm)).toBe(true);
  });

  it("detects incomplete weights", () => {
    expect(weightsAreComplete(sppm.slice(0, -1))).toBe(false);
  });

  it("avoids floating point drift", () => {
    const items: Assessment[] = [0.1, 0.2, 99.7].map((weight, index) => ({
      id: String(index),
      title: String(index),
      kind: "quiz",
      weight,
    }));
    expect(weightsAreComplete(items)).toBe(true);
  });
});

describe("requiredMarks", () => {
  it("computes the minimum continuous, final and overall marks", () => {
    expect(requiredMarks(sppm, rule)).toEqual({
      continuousMax: 70,
      finalMax: 30,
      continuousNeeded: 21,
      finalNeeded: 6,
      overallNeeded: 40,
    });
  });
});

describe("marksAtStake", () => {
  it("sums unscored assessments due within the horizon", () => {
    expect(marksAtStake(sppm, "2026-11-01", 14)).toBe(5);
    expect(marksAtStake(sppm, "2026-11-01", 15)).toBe(5 + 15);
    expect(marksAtStake(sppm, "2026-11-01", 30)).toBe(5 + 15 + 15);
  });

  it("ignores scored and undated assessments", () => {
    const scored = sppm.map((item) => (item.id === "quiz" ? { ...item, score: 4 } : item));
    expect(marksAtStake(scored, "2026-11-01", 15)).toBe(15);
    expect(marksAtStake(sppm, "2027-03-01", 30)).toBe(0);
  });
});
