/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { Metadata } from "next";
import { z } from "zod";
import { Badge, Card } from "@/components/card";
import { Form } from "@/components/form";
import { EmptyState, Field, inputClass, PageHeader } from "@/components/ui";
import { TIME_ZONE } from "@/config";
import { canWrite } from "@/domain/features";
import { STUDY_CATALOG } from "@/domain/study-catalog";
import {
  activeDays,
  buildPlan,
  checkLoad,
  DEFAULT_SETTINGS,
  loadLabel,
  minutesByDay,
  nextActions,
  overallReadiness,
  type StudyCourse,
  type StudySettings,
  streak,
} from "@/domain/study-plan";
import { addDays, type LocalDate, weekdayOf, zonedNow } from "@/domain/time";
import { requireFeature } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addCatalogCourseAction, logSessionAction, saveSettingsAction } from "./actions";
import { CourseCard, type CoursePaper } from "./course-card";
import { FocusTimer } from "./focus-timer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Study" };

const courseRow = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
  color: z.string(),
  exam_date: z.string().nullable(),
  weight: z.coerce.number(),
});
const unitRow = z.object({
  id: z.uuid(),
  course_id: z.uuid(),
  topic: z.string(),
  title: z.string(),
  position: z.number(),
});
const progressRow = z.object({ unit_id: z.uuid(), done_at: z.string() });
const sessionRow = z.object({
  session_date: z.string(),
  minutes: z.number(),
  course_id: z.uuid().nullable(),
});
const paperRow = z.object({
  id: z.uuid(),
  course_id: z.uuid(),
  taken_on: z.string(),
  score_pct: z.coerce.number(),
  note: z.string(),
});
const settingsRow = z.object({
  daily_goal_min: z.number(),
  unit_minutes: z.number(),
  rest_days: z.array(z.number()),
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const dayLabel = (date: LocalDate, today: LocalDate): string => {
  if (date === today) {
    return "Today";
  }
  if (date === addDays(today, 1)) {
    return "Tomorrow";
  }
  return `${WEEKDAYS[weekdayOf(date) - 1]} ${date.slice(8)}/${date.slice(5, 7)}`;
};

const doneDate = (iso: string): LocalDate => zonedNow(new Date(iso), TIME_ZONE).date;

export default async function StudyPage() {
  const session = await requireFeature("study");
  const supabase = await createClient();
  const workspace = session.active.id;
  const today = zonedNow(new Date(), TIME_ZONE).date;
  const since = addDays(today, -120);

  const [courses, units, progress, sessions, papers, settingsData] = await Promise.all([
    supabase
      .from("study_courses")
      .select("id, code, title, color, exam_date, weight")
      .eq("workspace_id", workspace)
      .order("code"),
    supabase
      .from("study_units")
      .select("id, course_id, topic, title, position")
      .eq("workspace_id", workspace)
      .order("position")
      .limit(5000),
    supabase
      .from("study_progress")
      .select("unit_id, done_at")
      .eq("workspace_id", workspace)
      .eq("user_id", session.userId)
      .limit(5000),
    supabase
      .from("study_sessions")
      .select("session_date, minutes, course_id")
      .eq("workspace_id", workspace)
      .eq("user_id", session.userId)
      .gte("session_date", since)
      .limit(5000),
    supabase
      .from("study_papers")
      .select("id, course_id, taken_on, score_pct, note")
      .eq("workspace_id", workspace)
      .eq("user_id", session.userId)
      .order("taken_on", { ascending: false })
      .limit(500),
    supabase
      .from("study_settings")
      .select("daily_goal_min, unit_minutes, rest_days")
      .eq("workspace_id", workspace)
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);

  const failed = [courses, units, progress, sessions, papers].some((result) => result.error);
  const parsed = {
    courses: z.array(courseRow).safeParse(courses.data ?? []),
    units: z.array(unitRow).safeParse(units.data ?? []),
    progress: z.array(progressRow).safeParse(progress.data ?? []),
    sessions: z.array(sessionRow).safeParse(sessions.data ?? []),
    papers: z.array(paperRow).safeParse(papers.data ?? []),
    settings: settingsRow.nullable().safeParse(settingsData.data ?? null),
  };
  if (failed || Object.values(parsed).some((result) => !result.success)) {
    return (
      <EmptyState title="Your study data could not be loaded">
        <p>Try again in a moment.</p>
      </EmptyState>
    );
  }

  const settingsValue = parsed.settings.data;
  const settings: StudySettings = settingsValue
    ? {
        dailyGoalMin: settingsValue.daily_goal_min,
        unitMinutes: settingsValue.unit_minutes,
        restDays: settingsValue.rest_days,
      }
    : DEFAULT_SETTINGS;

  const doneByUnit = new Map(
    (parsed.progress.data ?? []).map((row) => [row.unit_id, doneDate(row.done_at)]),
  );
  const paperList: (CoursePaper & { courseId: string })[] = (parsed.papers.data ?? []).map(
    (row) => ({
      id: row.id,
      courseId: row.course_id,
      date: row.taken_on,
      scorePct: row.score_pct,
      note: row.note,
    }),
  );

  const studyCourses: StudyCourse[] = (parsed.courses.data ?? []).map((course) => {
    const own = (parsed.units.data ?? []).filter((unit) => unit.course_id === course.id);
    const doneOn: Record<string, LocalDate> = {};
    for (const unit of own) {
      const date = doneByUnit.get(unit.id);
      if (date) {
        doneOn[unit.id] = date;
      }
    }
    return {
      id: course.id,
      code: course.code,
      title: course.title,
      weight: course.weight,
      examDate: course.exam_date,
      units: own.map((unit) => ({
        id: unit.id,
        topic: unit.topic,
        title: unit.title,
        position: unit.position,
      })),
      doneOn,
      papers: paperList
        .filter((paper) => paper.courseId === course.id)
        .map((paper) => ({ date: paper.date, scorePct: paper.scorePct })),
      recallAccuracy: null,
    };
  });

  const minutes = minutesByDay(
    (parsed.sessions.data ?? []).map((row) => ({ date: row.session_date, minutes: row.minutes })),
  );
  const todayMinutes = minutes.get(today) ?? 0;
  const days = streak(activeDays(minutes, studyCourses), today);
  const readiness = overallReadiness(studyCourses);
  const load = checkLoad(studyCourses, today, settings);
  const actions = nextActions(studyCourses, today);
  const plan = buildPlan(studyCourses, settings, today, 7);
  const courseById = new Map(studyCourses.map((course) => [course.id, course]));
  const canEdit = canWrite(session.membership, "study");
  const missing = STUDY_CATALOG.filter(
    (entry) => !studyCourses.some((course) => course.code === entry.code),
  );
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, -index));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study"
        subtitle="Exam dates, a daily plan, focus sessions and past papers in one place."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: `Today of ${settings.dailyGoalMin} min`, value: `${todayMinutes} min` },
          { label: "Day streak", value: String(days) },
          { label: "Overall readiness", value: `${Math.round(readiness * 100)}%` },
          { label: "Workload", value: loadLabel(load.load) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-lg font-semibold">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {load.load !== "no_deadline" ? (
        <p className="text-sm text-muted">
          Your exams need about <b>{Math.round(load.neededMinutesPerDay)} min a day</b> of new
          learning; you plan <b>{load.capacityMinutesPerDay} min</b>
          {load.heaviestCourseId
            ? ` · heaviest: ${courseById.get(load.heaviestCourseId)?.code}`
            : ""}
          .
        </p>
      ) : null}

      {actions.length > 0 ? (
        <Card title="Next best actions">
          <ol className="space-y-3">
            {actions.map((action) => (
              <li key={`${action.kind}-${action.courseId}-${action.unitId ?? ""}`}>
                <p className="font-medium">{action.title}</p>
                <p className="text-sm text-muted">{action.reason}</p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {studyCourses.length === 0 ? (
        <EmptyState title="No courses yet">
          <p>
            {canEdit
              ? "Add your course notebooks below. Each comes with its full list of units."
              : "Ask the workspace owner to add the courses."}
          </p>
        </EmptyState>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {studyCourses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            today={today}
            settings={settings}
            papers={paperList.filter((paper) => paper.courseId === course.id)}
            canEdit={canEdit}
          />
        ))}
      </div>

      {canEdit && missing.length > 0 ? (
        <Card title="Add a course">
          <div className="space-y-3">
            {missing.map((entry) => (
              <Form
                key={entry.id}
                action={addCatalogCourseAction}
                submit={`Add ${entry.code}`}
                tone="quiet"
              >
                <input type="hidden" name="catalogId" value={entry.id} />
                <p className="text-sm">
                  {entry.title}{" "}
                  <span className="text-muted">
                    ({entry.topics.reduce((sum, topic) => sum + topic.units.length, 0)} units)
                  </span>
                </p>
              </Form>
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Next 7 days" aside={<Badge>{settings.unitMinutes} min blocks</Badge>}>
        <ul className="divide-y divide-border">
          {plan.map((day) => (
            <li key={day.date} className="py-3">
              <p className="text-sm font-medium">{dayLabel(day.date, today)}</p>
              {day.rest ? (
                <p className="text-sm text-muted">Rest day</p>
              ) : day.blocks.length === 0 ? (
                <p className="text-sm text-muted">Nothing planned. Add a course or an exam date.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {day.blocks.map((block) => (
                    <li key={`${day.date}-${block.slot}`}>
                      <Badge
                        tone={
                          block.kind === "exam"
                            ? "warn"
                            : block.kind === "review"
                              ? "accent"
                              : "neutral"
                        }
                      >
                        {block.kind}
                      </Badge>{" "}
                      {block.label}
                      {block.minutes ? (
                        <span className="text-muted"> ({block.minutes} min)</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Focus timer">
          <FocusTimer
            courses={studyCourses.map((course) => ({ id: course.id, code: course.code }))}
          />
        </Card>
        <Card title="Last 7 days">
          <ul className="space-y-2 text-sm">
            {week.map((date) => {
              const value = minutes.get(date) ?? 0;
              const width = Math.min(
                100,
                Math.round((value / Math.max(1, settings.dailyGoalMin)) * 100),
              );
              return (
                <li key={date} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-muted">{dayLabel(date, today)}</span>
                  <span
                    className="h-2 flex-1 rounded bg-surface-2"
                    role="img"
                    aria-label={`${value} minutes`}
                  >
                    <span className="block h-2 rounded bg-accent" style={{ width: `${width}%` }} />
                  </span>
                  <span className="w-14 text-right tabular-nums">{value} min</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Log study time">
          <Form action={logSessionAction} submit="Log time" tone="quiet">
            <Field label="Course" htmlFor="log-course">
              <select id="log-course" name="courseId" className={inputClass} defaultValue="">
                <option value="">No course</option>
                {studyCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Minutes" htmlFor="log-min">
              <input
                id="log-min"
                name="minutes"
                type="number"
                min={1}
                max={600}
                defaultValue={30}
                required
                className={inputClass}
              />
            </Field>
            <Field label="What did you do? (optional)" htmlFor="log-note">
              <input id="log-note" name="note" maxLength={200} className={inputClass} />
            </Field>
          </Form>
        </Card>

        <Card title="Planning settings">
          <Form action={saveSettingsAction} submit="Save settings" tone="quiet">
            <Field label="Daily study goal (minutes)" htmlFor="set-goal">
              <input
                id="set-goal"
                name="dailyGoalMin"
                type="number"
                min={10}
                max={720}
                defaultValue={settings.dailyGoalMin}
                required
                className={inputClass}
              />
            </Field>
            <Field
              label="Minutes per unit"
              htmlFor="set-unit"
              hint="How long one subtopic takes you."
            >
              <input
                id="set-unit"
                name="unitMinutes"
                type="number"
                min={5}
                max={240}
                defaultValue={settings.unitMinutes}
                required
                className={inputClass}
              />
            </Field>
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Rest days</legend>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map((name, index) => (
                  <label key={name} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      name="restDays"
                      value={index + 1}
                      defaultChecked={settings.restDays.includes(index + 1)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
          </Form>
        </Card>
      </div>
    </div>
  );
}
