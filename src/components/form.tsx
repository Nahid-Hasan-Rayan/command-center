/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use client";

import { type ReactNode, useActionState } from "react";
import type { FormAction, FormState } from "@/lib/form-state";
import { buttonClass } from "./ui";

interface FormProps {
  action: FormAction;
  submit: string;
  children: ReactNode;
  className?: string;
  tone?: "primary" | "quiet" | "danger";
}

const initial: FormState = {};

export function Form({ action, submit, children, className, tone = "primary" }: FormProps) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className={className ?? "space-y-3"}>
      {children}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="break-all text-sm text-success">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass(tone)}>
        {pending ? "Working…" : submit}
      </button>
    </form>
  );
}
