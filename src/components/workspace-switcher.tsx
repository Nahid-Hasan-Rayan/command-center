/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { switchWorkspaceAction } from "@/app/actions-workspace";
import type { WorkspaceRef } from "@/lib/session";
import { buttonClass } from "./ui";

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: WorkspaceRef[];
  activeId: string;
}) {
  if (workspaces.length < 2) {
    return <span className="text-sm text-muted">{workspaces[0]?.name}</span>;
  }
  return (
    <form action={switchWorkspaceAction} className="flex items-center gap-2">
      <label htmlFor="workspace" className="sr-only">
        Workspace
      </label>
      <select
        id="workspace"
        name="workspace"
        defaultValue={activeId}
        className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm"
      >
        {workspaces.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
      <button type="submit" className={buttonClass("quiet")}>
        Switch
      </button>
    </form>
  );
}
