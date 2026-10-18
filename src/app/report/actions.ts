/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use server";

import { revalidatePath } from "next/cache";
import { type FormState, GENERIC_ERROR } from "@/lib/form-state";
import { timeAction } from "@/lib/monitoring";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { bugReportSchema } from "@/lib/validation";

export async function submitBugReportAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return timeAction("report.submit", async () => {
    const session = await requireSession();
    const parsed = bugReportSchema.safeParse({
      summary: formData.get("summary") ?? "",
      details: formData.get("details") ?? "",
      page: formData.get("page") ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("bug_reports").insert({
      user_id: session.userId,
      summary: parsed.data.summary,
      details: parsed.data.details ?? "",
      page: parsed.data.page ?? "",
    });
    if (error) {
      return {
        error:
          error.code === "54000"
            ? "You sent several reports in the last hour. Please wait a little."
            : GENERIC_ERROR,
      };
    }
    revalidatePath("/report");
    return { message: "Thank you. The administrator will look at it." };
  });
}
