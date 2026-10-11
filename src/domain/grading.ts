/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { compareDates, diffDays, type LocalDate } from "./time";

export type AssessmentKind =
  | "quiz"
  | "test"
  | "midterm"
  | "lab"
  | "lab_test"
  | "assignment"
  | "project"
  | "presentation"
  | "final";

export interface Assessment {
  id: string;
  title: string;
  kind: AssessmentKind;
  weight: number;
  dueDate?: LocalDate;
  score?: number;
}

export interface PassRule {
  continuousMinPct: number;
  finalMinPct: number;
  overallMinPct: number;
}

export interface RequiredMarks {
  continuousMax: number;
  finalMax: number;
  continuousNeeded: number;
  finalNeeded: number;
  overallNeeded: number;
}

const roundTwo = (value: number): number => Math.round(value * 100) / 100;

export function totalWeight(assessments: Assessment[]): number {
  return roundTwo(assessments.reduce((sum, item) => sum + item.weight, 0));
}

export function weightsAreComplete(assessments: Assessment[]): boolean {
  return totalWeight(assessments) === 100;
}

export function requiredMarks(assessments: Assessment[], rule: PassRule): RequiredMarks {
  const finalMax = assessments
    .filter((item) => item.kind === "final")
    .reduce((sum, item) => sum + item.weight, 0);
  const continuousMax = totalWeight(assessments) - finalMax;
  return {
    continuousMax: roundTwo(continuousMax),
    finalMax: roundTwo(finalMax),
    continuousNeeded: roundTwo((continuousMax * rule.continuousMinPct) / 100),
    finalNeeded: roundTwo((finalMax * rule.finalMinPct) / 100),
    overallNeeded: rule.overallMinPct,
  };
}

export function marksAtStake(
  assessments: Assessment[],
  from: LocalDate,
  horizonDays: number,
): number {
  return roundTwo(
    assessments
      .filter(
        (item) =>
          item.score === undefined &&
          item.dueDate !== undefined &&
          compareDates(item.dueDate, from) >= 0 &&
          diffDays(item.dueDate, from) <= horizonDays,
      )
      .reduce((sum, item) => sum + item.weight, 0),
  );
}
