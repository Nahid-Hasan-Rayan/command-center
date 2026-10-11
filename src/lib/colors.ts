/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { courses } from "@/data/semester-2026-27-1";

const PALETTE = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
  "#999999",
] as const;

const FALLBACK = "#999999";

export function courseColor(courseCode: string): string {
  const index = courses.findIndex((course) => course.code === courseCode);
  return index < 0 ? FALLBACK : (PALETTE[index % PALETTE.length] ?? FALLBACK);
}
