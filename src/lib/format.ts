/**
 * NHR
 * @author Nahid Hasan Rayan
 */

import { TIME_ZONE } from "@/config";
import type { PeriodKind } from "@/domain/calendar";
import { formatClock, type LocalDate } from "@/domain/time";

const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const asUtc = (date: LocalDate): Date => new Date(`${date}T00:00:00Z`);

export const formatLongDate = (date: LocalDate): string => longDate.format(asUtc(date));
export const formatShortDate = (date: LocalDate): string => shortDate.format(asUtc(date));
export const formatDayMonth = (date: LocalDate): string => dayMonth.format(asUtc(date));

/** An ISO timestamp in the campus time zone, for example "14 Oct 2026, 09:30". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateTime.format(date);
}

export const formatRange = (startMinutes: number, endMinutes: number): string =>
  `${formatClock(startMinutes)}–${formatClock(endMinutes)}`;

export function formatDaysUntil(days: number): string {
  if (days === 0) {
    return "today";
  }
  if (days === 1) {
    return "tomorrow";
  }
  return `in ${days} days`;
}

export const periodLabel: Record<PeriodKind, string> = {
  orientation: "Orientation",
  lectures: "Lectures",
  break: "Break",
  revision: "Revision",
  exams: "Exams",
  "final-break": "Final break",
};
