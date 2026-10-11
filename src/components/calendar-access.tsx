/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import type { ReactNode } from "react";
import { canView } from "@/domain/features";
import { requireSession } from "@/lib/session";
import { EmptyState } from "./ui";

export function seedWorkspaceId(): string | null {
  return process.env.SEED_WORKSPACE_ID ?? null;
}

export async function CalendarAccess({ children }: { children: ReactNode }) {
  const session = await requireSession();

  if (!canView(session.membership, "calendar")) {
    return (
      <EmptyState title="Welcome">
        <p>Your access is limited to the features shown in the menu above.</p>
      </EmptyState>
    );
  }

  if (session.active.id !== seedWorkspaceId()) {
    return (
      <EmptyState title="No calendar data in this workspace yet">
        <p>Course and timetable data has not been set up for “{session.active.name}”.</p>
        {session.membership.role === "owner" ? (
          <p>
            To show your semester data here, set{" "}
            <code className="font-mono">SEED_WORKSPACE_ID</code> to{" "}
            <code className="break-all font-mono">{session.active.id}</code> in the deployment
            settings.
          </p>
        ) : null}
      </EmptyState>
    );
  }

  return <>{children}</>;
}
