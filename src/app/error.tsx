/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/ui";
import { reportClientErrorAction } from "./error-actions";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientErrorAction(error.digest ?? "");
  }, [error.digest]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">
        The administrator has been told. You can try again, or report what you were doing.
      </p>
      <div className="flex justify-center gap-2">
        <button type="button" className={buttonClass("primary")} onClick={reset}>
          Try again
        </button>
        <a className={buttonClass("quiet")} href="/report">
          Report a problem
        </a>
      </div>
    </div>
  );
}
