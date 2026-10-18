/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { revalidatePath } from "next/cache";
import { TIME_ZONE } from "@/config";
import { canWrite } from "@/domain/features";
import { catalogRows, findCatalogCourse } from "@/domain/study-catalog";
import { zonedNow } from "@/domain/time";
import { type FormState, GENERIC_ERROR } from "@/lib/form-state";
import { timeAction } from "@/lib/monitoring";
import { requireFeature } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  catalogCourseSchema,
  examDateSchema,
  studyPaperSchema,
  studySessionSchema,
  studySettingsSchema,
  uuidSchema,
} from "@/lib/validation";

const NOT_ALLOWED: FormState = { error: "You can read these courses but not change them." };

function refresh(): void {
  revalidatePath("/study");
}

/** Courses are shared in the workspace, so only editors and owners change them. */
export async function addCatalogCourseAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return timeAction("study.add_catalog_course", async () => {
    const session = await requireFeature("study");
    if (!canWrite(session.membership, "study")) {
      return NOT_ALLOWED;
    }
    const parsed = catalogCourseSchema.safeParse({ catalogId: formData.get("catalogId") });
    const course = parsed.success ? findCatalogCourse(parsed.data.catalogId) : undefined;
    if (!course) {
      return { error: "Choose a course to add." };
    }

    const supabase = await createClient();
    const { data: created, error } = await supabase
      .from("study_courses")
      .insert({
        workspace_id: session.active.id,
        code: course.code,
        title: course.title,
        color: course.color,
        catalog_id: course.id,
        created_by: session.userId,
      })
      .select("id")
      .single();
    if (error || !created) {
      return {
        error:
          error?.code === "23505" ? `${course.code} is already in this workspace.` : GENERIC_ERROR,
      };
    }

    const rows = catalogRows(course).map((row) => ({
      ...row,
      workspace_id: session.active.id,
      course_id: created.id,
    }));
    const { error: unitError } = await supabase.from("study_units").insert(rows);
    if (unitError) {
      await supabase.from("study_courses").delete().eq("id", created.id);
      return { error: GENERIC_ERROR };
    }
    refresh();
    return { message: `${course.code} added with ${rows.length} units.` };
  });
}

export async function setExamDateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return timeAction("study.set_exam_date", async () => {
    const session = await requireFeature("study");
    if (!canWrite(session.membership, "study")) {
      return NOT_ALLOWED;
    }
    const parsed = examDateSchema.safeParse({
      courseId: formData.get("courseId"),
      examDate: formData.get("examDate") ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("study_courses")
      .update({ exam_date: parsed.data.examDate })
      .eq("id", parsed.data.courseId)
      .eq("workspace_id", session.active.id);
    if (error) {
      return { error: GENERIC_ERROR };
    }
    refresh();
    return { message: parsed.data.examDate ? "Exam date saved." : "Exam date cleared." };
  });
}

export async function deleteCourseAction(formData: FormData): Promise<void> {
  return timeAction("study.delete_course", async () => {
    const session = await requireFeature("study");
    const parsed = uuidSchema.safeParse(formData.get("courseId"));
    if (!parsed.success || !canWrite(session.membership, "study")) {
      return;
    }
    const supabase = await createClient();
    await supabase
      .from("study_courses")
      .delete()
      .eq("id", parsed.data)
      .eq("workspace_id", session.active.id);
    refresh();
  });
}

/** Finished or not, one tap. The row is private to the person. */
export async function toggleUnitAction(formData: FormData): Promise<void> {
  return timeAction("study.toggle_unit", async () => {
    const session = await requireFeature("study");
    const parsed = uuidSchema.safeParse(formData.get("unitId"));
    if (!parsed.success) {
      return;
    }
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("study_progress")
      .select("unit_id")
      .eq("unit_id", parsed.data)
      .eq("user_id", session.userId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("study_progress")
        .delete()
        .eq("unit_id", parsed.data)
        .eq("user_id", session.userId);
    } else {
      await supabase.from("study_progress").insert({
        user_id: session.userId,
        workspace_id: session.active.id,
        unit_id: parsed.data,
        done_at: new Date().toISOString(),
      });
    }
    refresh();
  });
}

export async function logSessionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return timeAction("study.log_session", async () => {
    const session = await requireFeature("study");
    const parsed = studySessionSchema.safeParse({
      courseId: formData.get("courseId") ?? "",
      minutes: formData.get("minutes"),
      note: formData.get("note") ?? "",
      source: "manual",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("study_sessions").insert({
      user_id: session.userId,
      workspace_id: session.active.id,
      course_id: parsed.data.courseId,
      session_date: zonedNow(new Date(), TIME_ZONE).date,
      minutes: parsed.data.minutes,
      source: "manual",
      note: parsed.data.note ?? "",
    });
    if (error) {
      return { error: GENERIC_ERROR };
    }
    refresh();
    return { message: "Logged." };
  });
}

/** Called by the focus timer when a session completes. */
export async function logTimerSessionAction(
  courseId: string,
  minutes: number,
): Promise<{ ok: boolean }> {
  return timeAction("study.log_timer_session", async () => {
    const session = await requireFeature("study");
    const parsed = studySessionSchema.safeParse({
      courseId,
      minutes,
      note: "Focus session",
      source: "timer",
    });
    if (!parsed.success) {
      return { ok: false };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("study_sessions").insert({
      user_id: session.userId,
      workspace_id: session.active.id,
      course_id: parsed.data.courseId,
      session_date: zonedNow(new Date(), TIME_ZONE).date,
      minutes: parsed.data.minutes,
      source: "timer",
      note: "Focus session",
    });
    refresh();
    return { ok: !error };
  });
}

export async function addPaperAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return timeAction("study.add_paper", async () => {
    const session = await requireFeature("study");
    const parsed = studyPaperSchema.safeParse({
      courseId: formData.get("courseId"),
      takenOn: formData.get("takenOn"),
      scorePct: formData.get("scorePct"),
      note: formData.get("note") ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("study_papers").insert({
      user_id: session.userId,
      workspace_id: session.active.id,
      course_id: parsed.data.courseId,
      taken_on: parsed.data.takenOn,
      score_pct: parsed.data.scorePct,
      note: parsed.data.note ?? "",
    });
    if (error) {
      return { error: GENERIC_ERROR };
    }
    refresh();
    return { message: "Paper logged." };
  });
}

export async function deletePaperAction(formData: FormData): Promise<void> {
  return timeAction("study.delete_paper", async () => {
    const session = await requireFeature("study");
    const parsed = uuidSchema.safeParse(formData.get("paperId"));
    if (!parsed.success) {
      return;
    }
    const supabase = await createClient();
    await supabase
      .from("study_papers")
      .delete()
      .eq("id", parsed.data)
      .eq("user_id", session.userId);
    refresh();
  });
}

export async function saveSettingsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return timeAction("study.save_settings", async () => {
    const session = await requireFeature("study");
    const parsed = studySettingsSchema.safeParse({
      dailyGoalMin: formData.get("dailyGoalMin"),
      unitMinutes: formData.get("unitMinutes"),
      restDays: formData.getAll("restDays"),
    });
    if (!parsed.success) {
      return { error: "Check the numbers: goal 10 to 720 minutes, unit 5 to 240 minutes." };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("study_settings").upsert({
      user_id: session.userId,
      workspace_id: session.active.id,
      daily_goal_min: parsed.data.dailyGoalMin,
      unit_minutes: parsed.data.unitMinutes,
      rest_days: parsed.data.restDays,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return { error: GENERIC_ERROR };
    }
    refresh();
    return { message: "Saved." };
  });
}
