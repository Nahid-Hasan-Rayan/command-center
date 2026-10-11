/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessageAction } from "@/app/messages/actions";
import type { FormState } from "@/lib/form-state";
import { buttonClass, inputClass } from "./ui";

const initial: FormState = {};

export function MessageComposer({ channelId }: { channelId: string }) {
  const [state, action, pending] = useActionState(sendMessageAction, initial);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      form.current?.reset();
    }
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-2">
      <input type="hidden" name="channelId" value={channelId} />
      <label htmlFor="body" className="sr-only">
        Message
      </label>
      <textarea
        id="body"
        name="body"
        required
        maxLength={4000}
        rows={3}
        placeholder="Write a message"
        className={inputClass}
      />
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass()}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
