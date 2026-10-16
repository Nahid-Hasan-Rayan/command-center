# Mastery Hub: reference teardown

Mastery Hub is a single 2.5 MB HTML file that embeds five notebooks (DSA, HCI, OS, Agile, Industry
Protocol) and adds a planning layer on top. It is the reference Command Center must match and beat.
This page records what it does, how, where it is weak, and what Command Center does about each point.

## What it does

| Area | Behaviour |
|---|---|
| Home | Greeting, today's minutes against a goal, streak, subtopics done, readiness, up to four "next best actions". |
| Exam War Room | Per course: exam date, phase (learn above 14 days, papers 14 to 4, revise 3 to 1, exam), required units and hours per day, readiness, past-paper log with "what cost me marks", a 7-day plan, a full-marks checklist. |
| Focus | Pomodoro with presets (25/5, 50/10, 90/15), completed sessions logged to a course, passive tracking of active time inside notebooks, manual log, 7-day bars per course. |
| Weak-spot drill | Collects missed flashcards from every notebook. |
| Search | Ctrl+K over 252 subtopics plus 119 career tasks, deep links into the exact subtopic. |
| Habits | Daily checklist, journal, coding-problem counter. |
| Backup | Export and import of every key, in-memory fallback when storage is blocked, theme sync into frames. |

## The algorithms (kept as the baseline)

- Readiness = mastery 50% + recall accuracy 20% (needs 5 or more ratings) + last three papers 30%, normalised over what exists.
- Urgency = remaining units / max(3, days left), times 1.5 inside 30 days, times 1.4 inside 14 days. Zero after the exam.
- Learning window = days left minus 14 when more than 14 remain, otherwise days left minus 3, at least one day.
- Streak = consecutive active days, where today may still be empty.
- Plan = per block, give the block to the course with the highest urgency divided by (1 + blocks already given today).

## Where it is weak

1. **One device, one browser.** Everything is `localStorage`. Clearing site data or changing phone loses it. Backup is manual.
2. **No people.** No accounts, approval, roles, or admin view. It cannot be shared or supervised.
3. **Fragile coupling.** Progress is read out of each notebook's private `localStorage` keys. Rename a key and the hub silently shows 0%. DSA problems are counted from the protocol file only, not the DSA notebook's own problem log, so there are two sources of truth.
4. **Pace is per course.** It shows what each course needs, but never adds them up against the hours you really have.
5. **No rest days or capacity.** The plan assumes the same blocks every day, including the day you said you would not study.
6. **No spaced review.** A finished unit is never scheduled again.
7. **Browser clock.** Dates use the device's local time zone, which breaks when you travel or relocate.
8. **Untested.** No automated tests of any of the maths.
9. **Trust.** Notebooks run same-origin inside the hub, so any notebook script can read everything. Fine for your own files, unsafe for uploaded ones.
10. **Weight.** Notebook source is duplicated as escaped JSON strings; every notebook edit means rebuilding a 2.5 MB file.

## How Command Center answers each point

| Hub gap | Command Center |
|---|---|
| 1 One device | Postgres, row-level security, every device sees the same data. |
| 2 No people | Registration requests, approval, per-person features, admin console, audit trail. |
| 3 Coupling | Units and progress are real rows (`study_units`, `study_progress`). Notebooks run as sandboxed tools with bridged state. |
| 4 Pace per course | `checkLoad` adds every course and compares it with your daily goal: on track, tight, at risk, overloaded. |
| 5 No rest days | `study_settings.rest_days`; pace and plan skip rest days. |
| 6 No spaced review | Units finished 1, 3, 7 and 14 days ago come back as review blocks and "next best actions". |
| 7 Browser clock | Dates are plain `YYYY-MM-DD` computed in the configured time zone, with no `Date` local-time arithmetic. |
| 8 Untested | `study-plan.test.ts` (36 tests), catalog tests, pgTAP tests for every policy. |
| 9 Trust | Tools are sandboxed, hash-approved by the owner, and re-approval is required when the HTML changes. |
| 10 Weight | Catalog is 20 KB of JSON; notebooks are uploaded once as tools. |

## Parity checklist

Done: exam dates and phases, daily pace, readiness, next best actions, 7-day plan, past-paper log, focus timer with auto-logging, manual log, 7-day bars, streak, catalog of all 252 units.

Still to build: cross-notebook search with deep links, weak-spot drill fed from the notebooks' flashcard ratings (needs the tool bridge to expose them), daily habits and journal, the career tracker (119 tasks), coding-problem log, ICS export, backup export of study data, installable push reminders.
