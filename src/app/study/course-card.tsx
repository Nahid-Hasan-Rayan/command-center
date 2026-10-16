/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { Badge, Card } from "@/components/card";
import { Form } from "@/components/form";
import { Field, inputClass } from "@/components/ui";
import {
  paceFor,
  paperAverage,
  phaseOf,
  readiness,
  remainingUnits,
  type StudyCourse,
  type StudySettings,
} from "@/domain/study-plan";
import { diffDays, type LocalDate } from "@/domain/time";
import {
  addPaperAction,
  deleteCourseAction,
  deletePaperAction,
  setExamDateAction,
  toggleUnitAction,
} from "./actions";

export interface CoursePaper {
  id: string;
  date: LocalDate;
  scorePct: number;
  note: string;
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

function UnitToggle({ unitId, done, title }: { unitId: string; done: boolean; title: string }) {
  return (
    <form action={toggleUnitAction} className="flex items-start gap-2">
      <input type="hidden" name="unitId" value={unitId} />
      <button
        type="submit"
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
          done ? "border-accent bg-accent text-black" : "border-border bg-surface-2"
        }`}
        aria-pressed={done}
        aria-label={`${done ? "Mark not done" : "Mark done"}: ${title}`}
      >
        {done ? "✓" : ""}
      </button>
      <span className={`text-sm ${done ? "text-muted line-through" : ""}`}>{title}</span>
    </form>
  );
}

export function CourseCard({
  course,
  today,
  settings,
  papers,
  canEdit,
}: {
  course: StudyCourse;
  today: LocalDate;
  settings: StudySettings;
  papers: CoursePaper[];
  canEdit: boolean;
}) {
  const left = course.examDate ? diffDays(course.examDate, today) : null;
  const phase = phaseOf(left);
  const pace = paceFor(course, today, settings);
  const rest = remainingUnits(course);
  const average = paperAverage(course);
  const topics = new Map<string, StudyCourse["units"][number][]>();
  for (const unit of course.units) {
    topics.set(unit.topic, [...(topics.get(unit.topic) ?? []), unit]);
  }

  return (
    <Card
      title={`${course.code}: ${course.title}`}
      aside={<Badge tone="accent">{percent(readiness(course))} ready</Badge>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-semibold">
              {left === null ? "-" : left < 0 ? "done" : left}
            </p>
            <p className="text-xs text-muted">days left</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{pace ? pace.unitsPerDay.toFixed(1) : "-"}</p>
            <p className="text-xs text-muted">units a study day</p>
          </div>
          <div>
            <p className="text-xl font-semibold">
              {course.units.length - rest.length}/{course.units.length}
            </p>
            <p className="text-xs text-muted">units done</p>
          </div>
        </div>

        {phase && phase.index >= 0 ? (
          <div>
            <div className="flex gap-1" role="img" aria-label={`Phase: ${phase.label}`}>
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`h-2 flex-1 rounded ${index <= phase.index ? "bg-accent" : "bg-surface-2"}`}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              Learn, papers (last 14 days), revise (last 3 days), exam. Now: <b>{phase.label}</b>
            </p>
          </div>
        ) : null}

        <p className="text-sm text-muted">
          Papers, last three: <b>{average === null ? "no data" : percent(average)}</b>
          {course.recallAccuracy === null ? "" : ` · Recall ${percent(course.recallAccuracy)}`}
        </p>

        {canEdit ? (
          <Form action={setExamDateAction} submit="Save exam date" tone="quiet">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Exam date" htmlFor={`exam-${course.id}`} hint="Leave empty to clear it.">
              <input
                id={`exam-${course.id}`}
                name="examDate"
                type="date"
                defaultValue={course.examDate ?? ""}
                className={inputClass}
              />
            </Field>
          </Form>
        ) : null}

        {rest.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Next up</p>
            {rest.slice(0, 5).map((unit) => (
              <UnitToggle key={unit.id} unitId={unit.id} done={false} title={unit.title} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Every unit is done. Switch to timed past papers.</p>
        )}

        <details>
          <summary className="cursor-pointer text-sm font-medium">
            All units ({course.units.length})
          </summary>
          <div className="mt-3 space-y-4">
            {[...topics.entries()].map(([topic, units]) => (
              <div key={topic} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{topic}</p>
                {units.map((unit) => (
                  <UnitToggle
                    key={unit.id}
                    unitId={unit.id}
                    done={unit.id in course.doneOn}
                    title={unit.title}
                  />
                ))}
              </div>
            ))}
          </div>
        </details>

        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Past papers ({papers.length})
          </summary>
          <div className="mt-3 space-y-3">
            <Form action={addPaperAction} submit="Log paper" tone="quiet">
              <input type="hidden" name="courseId" value={course.id} />
              <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                <Field label="Date" htmlFor={`pd-${course.id}`}>
                  <input
                    id={`pd-${course.id}`}
                    name="takenOn"
                    type="date"
                    defaultValue={today}
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Score %" htmlFor={`ps-${course.id}`}>
                  <input
                    id={`ps-${course.id}`}
                    name="scorePct"
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    required
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="What cost me marks" htmlFor={`pn-${course.id}`}>
                <input id={`pn-${course.id}`} name="note" maxLength={300} className={inputClass} />
              </Field>
            </Form>
            {papers.length > 0 ? (
              <ul className="divide-y divide-border text-sm">
                {papers.map((paper) => (
                  <li key={paper.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {paper.date} · <b>{paper.scorePct}%</b>
                      {paper.note ? <span className="text-muted"> · {paper.note}</span> : null}
                    </span>
                    <form action={deletePaperAction}>
                      <input type="hidden" name="paperId" value={paper.id} />
                      <button
                        type="submit"
                        className="text-xs text-danger"
                        aria-label="Delete this paper"
                      >
                        Delete
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>

        {canEdit ? (
          <details>
            <summary className="cursor-pointer text-xs text-danger">Remove this course</summary>
            <form action={deleteCourseAction} className="mt-2 space-y-2">
              <p className="text-sm text-muted">
                This removes the course and its units for everyone in the workspace, and deletes the
                progress and paper scores people recorded for it. Logged study time is kept.
              </p>
              <input type="hidden" name="courseId" value={course.id} />
              <button
                type="submit"
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-danger"
              >
                Yes, remove {course.code}
              </button>
            </form>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
