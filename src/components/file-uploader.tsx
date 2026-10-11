/**
 * NHR
 * @author Nahid Hasan Rayan
 */
"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { finalizeUpload, prepareUpload } from "@/app/files/actions";
import { contentMatchesType, SNIFF_BYTES, validateUploadMeta } from "@/domain/files";
import { FILE_BUCKET } from "@/lib/storage";
import { createBrowser } from "@/lib/supabase/browser";
import { buttonClass } from "./ui";

export function FileUploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    const file = input.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const checked = validateUploadMeta({ name: file.name, mimeType: file.type, size: file.size });
      if (!checked.ok) {
        setError(checked.error);
        return;
      }
      const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
      if (!contentMatchesType(head, file.type)) {
        setError("The file content does not match its type.");
        return;
      }

      setStatus("Preparing…");
      const prepared = await prepareUpload({
        name: file.name,
        mimeType: file.type,
        size: file.size,
      });
      if (!prepared.ok) {
        setError(prepared.error);
        return;
      }

      setStatus("Uploading…");
      const { error: uploadError } = await createBrowser()
        .storage.from(FILE_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (uploadError) {
        setError("The upload failed. Try again.");
        return;
      }

      setStatus("Checking…");
      const finalized = await finalizeUpload(prepared.fileId);
      if (!finalized.ok) {
        setError(finalized.error);
        return;
      }
      if (input.current) {
        input.current.value = "";
      }
      router.refresh();
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="file" className="text-sm font-medium">
        Upload a file
      </label>
      <input
        id="file"
        ref={input}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.docx,.xlsx,.pptx"
        className="block w-full text-sm"
      />
      <p className="text-xs text-muted">PDF, images, text, CSV and Office files up to 10 MB.</p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-muted">
          {status}
        </p>
      ) : null}
      <button type="button" onClick={upload} disabled={busy} className={buttonClass()}>
        Upload
      </button>
    </div>
  );
}
