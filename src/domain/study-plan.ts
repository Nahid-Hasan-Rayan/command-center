/**
 * NHR
 * @author Nahid Hasan Rayan
 *
 * Study planning engine. Pure functions over plain data: no clock, no database, no browser.
 * Phases, readiness weights and the urgency curve follow the Mastery Hub reference. On top of it:
 * rest days, a capacity check across all courses, spaced reviews of finished units and
 * deterministic plans that can be unit tested.
 */

import { addDays, diffDays, type LocalDate, weekdayOf } from "./time";

export interface StudyUnit {
  id: string;
  topic: string;
  title: string;
  position: number;
}

export interface PaperScore {
  date: LocalDate;
  scorePct: number;
}

export interface StudyCourse {
  id: string;
  code: string;
  title: string;
  weight: number;
  examDate: LocalDate | null;
  units: readonly StudyUnit[];
  /** unit id to the date it was finished */
  doneOn: Readonly<Record<string, LocalDate>>;
  papers: readonly PaperScore[];
  /** Flashcard recall accuracy from 0 to 1, or null when there is too little data. */
  recallAccuracy: number | null;
}

export interface StudySettings {
  dailyGoalMin: number;
  unitMinutes: number;
  /** ISO weekdays with no study planned: 1 = Monday to 7 = Sunday */
  restDays: readonly number[];
}

export const DEFAULT_SETTINGS: StudySettings = { dailyGoalMin: 90, unitMinutes: 30, restDays: [] };

export interface Phase {
  index: -1 | 0 | 1 | 2 | 3;
  label: string;
}

/** Learn above 14 days, papers from 14 days, final revision in the last 3 days, then the exam. */
export function phaseOf(daysLeft: number | null): Phase | null {
  if (daysLeft === null) {
    return null;
  }
  if (daysLeft < 0) {
    return { index: -1, label: "Exam passed" };
  }
  if (daysLeft === 0) {
    return { index: 3, label: "Exam day" };
  }
  if (daysLeft <= 3) {
    return { index: 2, label: "Final revision" };
  }
  if (daysLeft <= 14) {
    return { index: 1, label: "Past-paper practice" };
  }
  return { index: 0, label: "Learn and understand" };
}

export function daysUntilExam(course: StudyCourse, today: LocalDate): number | null {
  return course.examDate ? diffDays(course.examDate, today) : null;
}

export function isRestDay(date: LocalDate, settings: StudySettings): boolean {
  return settings.restDays.includes(weekdayOf(date));
}

/** Study days in [from, until) that are not rest days. */
export function studyDaysBetween(
  from: LocalDate,
  until: LocalDate,
  settings: StudySettings,
): number {
  let count = 0;
  for (let day = from; diffDays(until, day) > 0; day = addDays(day, 1)) {
    if (!isRestDay(day, settings)) {
      count += 1;
    }
  }
  return count;
}

export function remainingUnits(course: StudyCourse): StudyUnit[] {
  return course.units
    .filter((unit) => !(unit.id in course.doneOn))
    .sort((a, b) => a.position - b.position);
}

export function mastery(course: StudyCourse): number {
  return course.units.length === 0 ? 0 : Object.keys(course.doneOn).length / course.units.length;
}

export function paperAverage(course: StudyCourse): number | null {
  const last = [...course.papers].sort((a, b) => diffDays(a.date, b.date)).slice(-3);
  if (last.length === 0) {
    return null;
  }
  return last.reduce((sum, paper) => sum + paper.scorePct, 0) / last.length / 100;
}

/** Mastery 50%, recall accuracy 20%, last three papers 30%, normalised over what exists. */
export function readiness(course: StudyCourse): number {
  let score = mastery(course) * 0.5;
  let weight = 0.5;
  if (course.recallAccuracy !== null) {
    score += course.recallAccuracy * 0.2;
    weight += 0.2;
  }
  const papers = paperAverage(course);
  if (papers !== null) {
    score += papers * 0.3;
    weight += 0.3;
  }
  return score / weight;
}

/** Overall readiness, weighted by course weight. Courses without units are ignored. */
export function overallReadiness(courses: readonly StudyCourse[]): number {
  const counted = courses.filter((course) => course.units.length > 0);
  const total = counted.reduce((sum, course) => sum + course.weight, 0);
  return total === 0
    ? 0
    : counted.reduce((sum, course) => sum + readiness(course) * course.weight, 0) / total;
}

export interface Pace {
  remaining: number;
  studyDays: number;
  unitsPerDay: number;
  minutesPerDay: number;
}

/**
 * Units per study day needed to finish learning in time. Learning ends 14 days before the exam
 * when there is that much time (leaving the papers phase), otherwise 3 days before it.
 */
export function paceFor(
  course: StudyCourse,
  today: LocalDate,
  settings: StudySettings,
): Pace | null {
  const left = daysUntilExam(course, today);
  if (left === null || left < 0 || !course.examDate) {
    return null;
  }
  const reserve = left > 14 ? 14 : 3;
  const learnUntil = addDays(course.examDate, -reserve);
  const studyDays = Math.max(1, studyDaysBetween(today, learnUntil, settings));
  const remaining = remainingUnits(course).length;
  const unitsPerDay = remaining / studyDays;
  return { remaining, studyDays, unitsPerDay, minutesPerDay: unitsPerDay * settings.unitMinutes };
}

export type Load = "no_deadline" | "on_track" | "tight" | "at_risk" | "overloaded";

export interface LoadCheck {
  load: Load;
  neededMinutesPerDay: number;
  capacityMinutesPerDay: number;
  /** Course driving the load, or null */
  heaviestCourseId: string | null;
}

/**
 * Compares what every course needs per day with what you can give. The Mastery Hub showed the
 * pace per course; this adds up all courses, because the hours are shared.
 */
export function checkLoad(
  courses: readonly StudyCourse[],
  today: LocalDate,
  settings: StudySettings,
): LoadCheck {
  let needed = 0;
  let heaviest: { id: string; minutes: number } | null = null;
  let withDeadline = 0;
  for (const course of courses) {
    const pace = paceFor(course, today, settings);
    if (!pace) {
      continue;
    }
    withDeadline += 1;
    needed += pace.minutesPerDay;
    if (!heaviest || pace.minutesPerDay > heaviest.minutes) {
      heaviest = { id: course.id, minutes: pace.minutesPerDay };
    }
  }
  const capacity = settings.dailyGoalMin;
  const ratio = capacity > 0 ? needed / capacity : Number.POSITIVE_INFINITY;
  let load: Load = "on_track";
  if (withDeadline === 0) {
    load = "no_deadline";
  } else if (ratio > 1.25) {
    load = "overloaded";
  } else if (ratio > 1) {
    load = "at_risk";
  } else if (ratio > 0.8) {
    load = "tight";
  }
  return {
    load,
    neededMinutesPerDay: needed,
    capacityMinutesPerDay: capacity,
    heaviestCourseId: heaviest?.id ?? null,
  };
}

export function loadLabel(load: Load): string {
  const labels: Record<Load, string> = {
    no_deadline: "Set exam dates to check your pace",
    on_track: "On track",
    tight: "Tight but possible",
    at_risk: "At risk: more time per day needed",
    overloaded: "Overloaded: change the plan",
  };
  return labels[load];
}

/** How much a course deserves your next block. Exam proximity and remaining work, times its weight. */
export function urgency(course: StudyCourse, today: LocalDate): number {
  const left = daysUntilExam(course, today);
  if (left !== null && left < 0) {
    return 0;
  }
  const remaining = remainingUnits(course).length;
  const days = left ?? 60;
  let value = remaining > 0 ? remaining / Math.max(3, days) : 0.25;
  if (left !== null && left <= 30) {
    value *= 1.5;
  }
  if (left !== null && left <= 14) {
    value *= 1.4;
  }
  return value * course.weight;
}

export function streak(activeDays: ReadonlySet<LocalDate>, today: LocalDate): number {
  let day = activeDays.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (activeDays.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

export type ActionKind = "learn" | "paper" | "review" | "set_date" | "deeper";

export interface NextAction {
  kind: ActionKind;
  courseId: string;
  unitId?: string;
  title: string;
  reason: string;
}

const REVIEW_GAPS = [1, 3, 7, 14] as const;

/** Units finished exactly 1, 3, 7 or 14 days ago, oldest first: the spaced review queue. */
export function reviewsDue(course: StudyCourse, date: LocalDate): StudyUnit[] {
  return course.units
    .filter((unit) => {
      const done = course.doneOn[unit.id];
      return (
        done !== undefined && (REVIEW_GAPS as readonly number[]).includes(diffDays(date, done))
      );
    })
    .sort((a, b) => diffDays(course.doneOn[a.id] ?? date, course.doneOn[b.id] ?? date));
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Up to four things worth doing now, most important first. */
export function nextActions(courses: readonly StudyCourse[], today: LocalDate): NextAction[] {
  const actions: NextAction[] = [];
  const active = courses.filter((course) => {
    const left = daysUntilExam(course, today);
    return left === null || left >= 0;
  });
  const ranked = [...active].sort((a, b) => urgency(b, today) - urgency(a, today));
  const best = ranked[0];

  if (best) {
    const left = daysUntilExam(best, today);
    const phase = phaseOf(left);
    const rest = remainingUnits(best);
    const next = rest[0];
    const fractionLeft = best.units.length ? rest.length / best.units.length : 0;
    if (left !== null && phase && phase.index >= 1 && fractionLeft > 0.25 && next) {
      actions.push({
        kind: "learn",
        courseId: best.id,
        unitId: next.id,
        title: `Race the clock: ${best.code}, ${next.title}`,
        reason: `${plural(left, "day")} to the exam with ${plural(rest.length, "unit")} left. Cover the high-yield units first, then past papers.`,
      });
    } else if (left !== null && phase && phase.index >= 1) {
      actions.push({
        kind: "paper",
        courseId: best.id,
        title: `Timed past paper: ${best.code}`,
        reason: `${plural(left, "day")} to the exam (${phase.label}). Do one under exam conditions, mark it honestly, fix every lost mark.`,
      });
    } else if (next) {
      actions.push({
        kind: "learn",
        courseId: best.id,
        unitId: next.id,
        title: `Continue ${best.code}: ${next.title}`,
        reason: `${plural(rest.length, "unit")} left. Learn it, then explain it aloud without notes.`,
      });
    } else if (best.units.length > 0) {
      actions.push({
        kind: "deeper",
        courseId: best.id,
        title: `All ${best.code} units done: go deeper`,
        reason: "Switch to timed past papers and recall practice to turn understanding into marks.",
      });
    }
  }

  const dateless = active.find((course) => !course.examDate && course.units.length > 0);
  if (dateless) {
    actions.push({
      kind: "set_date",
      courseId: dateless.id,
      title: `Set the exam date for ${dateless.code}`,
      reason: "Without a date there is no phase plan and no daily pace.",
    });
  }

  for (const course of ranked) {
    const due = reviewsDue(course, today);
    const first = due[0];
    if (first) {
      actions.push({
        kind: "review",
        courseId: course.id,
        unitId: first.id,
        title: `Review ${course.code}: ${first.title}`,
        reason: `${plural(due.length, "unit")} due for a spaced review today. Five minutes now saves an hour of relearning.`,
      });
      break;
    }
  }

  return actions.slice(0, 4);
}

/** The course as it would look if only `queue` were still to learn. Used to score planned days. */
function withRemaining(
  course: StudyCourse,
  queue: readonly StudyUnit[],
  on: LocalDate,
): StudyCourse {
  const waiting = new Set(queue.map((unit) => unit.id));
  const doneOn: Record<string, LocalDate> = { ...course.doneOn };
  for (const unit of course.units) {
    if (!waiting.has(unit.id) && !(unit.id in doneOn)) {
      doneOn[unit.id] = on;
    }
  }
  return { ...course, doneOn };
}

export type BlockKind = "learn" | "review" | "paper" | "revise" | "exam";

export interface PlanBlock {
  /** Position inside the day. Stable, so it works as a list key. */
  slot: number;
  kind: BlockKind;
  courseId: string;
  unitId?: string;
  label: string;
  minutes: number;
}

export interface PlanDay {
  date: LocalDate;
  rest: boolean;
  blocks: PlanBlock[];
}

/**
 * A day-by-day plan. Each block is one unit long. Every study day starts with spaced reviews that
 * are due (at most one block, only when the day has two or more blocks), then gives each block to
 * the course that needs it most, so courses interleave instead of running one after another.
 */
export function buildPlan(
  courses: readonly StudyCourse[],
  settings: StudySettings,
  today: LocalDate,
  days: number,
): PlanDay[] {
  const pending = new Map<string, StudyUnit[]>();
  const learnedOn = new Map<string, Map<string, LocalDate>>();
  for (const course of courses) {
    pending.set(course.id, remainingUnits(course));
    learnedOn.set(course.id, new Map(Object.entries(course.doneOn)));
  }
  const blocksPerDay = Math.max(1, Math.floor(settings.dailyGoalMin / settings.unitMinutes));
  const plan: PlanDay[] = [];

  for (let i = 0; i < days; i += 1) {
    const date = addDays(today, i);
    const blocks: Omit<PlanBlock, "slot">[] = [];
    const rest = isRestDay(date, settings);
    const assigned = new Map<string, number>();

    for (const course of courses) {
      if (course.examDate === date) {
        blocks.push({
          kind: "exam",
          courseId: course.id,
          label: `${course.code} exam`,
          minutes: 0,
        });
      }
    }

    if (!rest) {
      const open = courses.filter((course) => {
        const left = daysUntilExam(course, date);
        return left === null || left > 0;
      });

      if (blocksPerDay >= 2) {
        for (const course of open) {
          if (blocks.filter((block) => block.kind === "review").length >= 1) {
            break;
          }
          const dates = learnedOn.get(course.id) ?? new Map<string, LocalDate>();
          const view: StudyCourse = { ...course, doneOn: Object.fromEntries(dates) };
          const first = reviewsDue(view, date)[0];
          if (first) {
            blocks.push({
              kind: "review",
              courseId: course.id,
              unitId: first.id,
              label: `Review ${course.code}: ${first.title}`,
              minutes: settings.unitMinutes,
            });
            assigned.set(course.id, (assigned.get(course.id) ?? 0) + 1);
          }
        }
      }

      while (
        blocks.filter((block) => block.kind !== "exam").length < blocksPerDay &&
        open.length > 0
      ) {
        let chosen: StudyCourse | undefined;
        let bestScore = -1;
        for (const course of open) {
          const queue = pending.get(course.id) ?? [];
          const score =
            urgency(withRemaining(course, queue, date), date) /
            (1 + (assigned.get(course.id) ?? 0));
          if (score > bestScore) {
            bestScore = score;
            chosen = course;
          }
        }
        if (!chosen) {
          break;
        }
        const left = daysUntilExam(chosen, date);
        const queue = pending.get(chosen.id) ?? [];
        assigned.set(chosen.id, (assigned.get(chosen.id) ?? 0) + 1);

        if (left !== null && left <= 3) {
          blocks.push({
            kind: "revise",
            courseId: chosen.id,
            label: `${chosen.code}: final revision, formula sheet, weak spots, one more timed question`,
            minutes: settings.unitMinutes,
          });
        } else if (left !== null && left <= 14 && queue.length === 0) {
          blocks.push({
            kind: "paper",
            courseId: chosen.id,
            label: `${chosen.code}: timed past paper, then an error log`,
            minutes: settings.unitMinutes,
          });
        } else if (queue.length > 0) {
          const unit = queue.shift() as StudyUnit;
          learnedOn.get(chosen.id)?.set(unit.id, date);
          blocks.push({
            kind: "learn",
            courseId: chosen.id,
            unitId: unit.id,
            label: `${chosen.code}: ${unit.title}`,
            minutes: settings.unitMinutes,
          });
        } else {
          blocks.push({
            kind: "paper",
            courseId: chosen.id,
            label: `${chosen.code}: recall practice plus one past-paper question`,
            minutes: settings.unitMinutes,
          });
        }
      }
    }

    plan.push({ date, rest, blocks: blocks.map((block, slot) => ({ ...block, slot })) });
  }
  return plan;
}

/** Minutes studied per day, from session rows. */
export function minutesByDay(
  sessions: readonly { date: LocalDate; minutes: number }[],
): Map<LocalDate, number> {
  const totals = new Map<LocalDate, number>();
  for (const session of sessions) {
    totals.set(session.date, (totals.get(session.date) ?? 0) + session.minutes);
  }
  return totals;
}

/** Days with study time or a finished unit count as active for the streak. */
export function activeDays(
  minutes: ReadonlyMap<LocalDate, number>,
  courses: readonly StudyCourse[],
): Set<LocalDate> {
  const days = new Set<LocalDate>();
  for (const [date, total] of minutes) {
    if (total >= 1) {
      days.add(date);
    }
  }
  for (const course of courses) {
    for (const date of Object.values(course.doneOn)) {
      days.add(date);
    }
  }
  return days;
}
