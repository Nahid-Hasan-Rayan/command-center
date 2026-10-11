/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use client";

import { useState, useTransition } from "react";
import { type EnrollmentStart, startEnrollment, verifyEnrollmentAction } from "@/app/actions-auth";
import { Form } from "./form";
import { buttonClass, Field, inputClass } from "./ui";

export function EnrollTotp() {
  const [start, setStart] = useState<EnrollmentStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const begin = () => {
    setError(null);
    startTransition(async () => {
      const result = await startEnrollment();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStart(result);
    });
  };

  if (!start) {
    return (
      <div className="space-y-3">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button type="button" onClick={begin} disabled={pending} className={buttonClass()}>
          {pending ? "Preparing…" : "Set up authenticator app"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* biome-ignore lint/performance/noImgElement: the QR code is an inline data URL */}
      <img
        src={start.qrCode}
        alt="QR code for your authenticator app"
        className="mx-auto h-44 w-44 rounded-md bg-white p-2"
      />
      <p className="break-all text-center font-mono text-xs text-muted">{start.secret}</p>
      <Form action={verifyEnrollmentAction} submit="Turn on two-step sign-in">
        <input type="hidden" name="factorId" value={start.factorId} />
        <Field label="Code from the app" htmlFor="code">
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            className={inputClass}
          />
        </Field>
      </Form>
    </div>
  );
}
