"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileUp, UploadCloud } from "lucide-react";
import { ButtonLink, cx } from "@/components/workspace/kit";
import { ErrorNote } from "@/suite/lms/components/ui/ws";
import { banking, errorText, type BankAccount, type StatementDetail, type StatementSummary } from "@/lib/api/finance-banking-client";
import { day } from "@/suite/finance/lib/format";
import { TEMPLATES, isProcessing } from "./labels";
import { ImportStatusChip, VerifiedBadge } from "./ui";
import RetryImportButton from "./RetryImportButton";

/**
 * Upload a statement: drop the file or choose it. The API stores it and reads
 * it on the queue, so after the upload this follows the import - reading,
 * then verified (ready for review) or failed - and says what to do next.
 */
export default function StatementUpload({
  account,
  onSettled,
  canRetry = false,
  pollMs = 2000,
}: {
  account: Pick<BankAccount, "id" | "statementTemplate" | "name">;
  /** Told once the import has been read (either way), so the page can refresh. */
  onSettled?: (i: StatementSummary) => void;
  /** May run a failed import again (`statements.retry`). */
  canRetry?: boolean;
  pollMs?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<StatementSummary | StatementDetail | null>(null);
  const template = TEMPLATES[account.statementTemplate] ?? TEMPLATES.csv;
  const settled = useRef(onSettled);
  useEffect(() => {
    settled.current = onSettled;
  }, [onSettled]);

  // Follow the import while the queue reads it.
  const followId = current && isProcessing(current.status) ? current.id : null;
  useEffect(() => {
    if (followId === null) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      banking.statements
        .get(followId)
        .then((i) => {
          if (!alive) return;
          setCurrent(i);
          if (!isProcessing(i.status)) settled.current?.(i);
        })
        .catch((e: unknown) => alive && setError(`We lost track of the upload. ${errorText(e)} Open Statements to see how it went.`));
    }, pollMs);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [followId, current, pollMs]);

  const send = async (file: File | undefined) => {
    if (!file || busy) return;
    setError(null);
    setCurrent(null);
    setBusy(true);
    try {
      const made = await banking.statements.upload(account.id, file);
      setCurrent(made);
      if (!isProcessing(made.status)) settled.current?.(made);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void send(e.dataTransfer.files?.[0]);
        }}
        className={cx(
          "rounded-2xl border-2 border-dashed p-1 transition-colors",
          dragging ? "border-primary-500 bg-primary-50/70" : "border-neutral-200 bg-neutral-50/50",
        )}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl px-4 py-7 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-wait"
          aria-describedby="statement-format"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm ring-1 ring-neutral-200">
            {busy ? <FileUp size={22} aria-hidden className="animate-pulse motion-reduce:animate-none" /> : <UploadCloud size={22} aria-hidden />}
          </span>
          <span className="text-sm font-semibold text-neutral-900">{busy ? "Uploading…" : dragging ? "Drop the statement to upload it" : "Upload statement"}</span>
          <span className="text-xs text-neutral-500">Drag the file here, or choose it. Up to 20 MB.</span>
        </button>
        <input
          ref={input}
          type="file"
          accept={template.accept}
          className="sr-only"
          tabIndex={-1}
          aria-label={`Statement file for ${account.name}`}
          onChange={(e) => void send(e.target.files?.[0])}
        />
      </div>
      <p id="statement-format" className="text-xs text-neutral-500">
        <span className="font-semibold text-neutral-700">Expected: {template.label}.</span> {template.hint}
      </p>

      {error && <ErrorNote>{error}</ErrorNote>}

      {current && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-neutral-900">{current.fileName}</p>
            <span className="flex items-center gap-1.5">
              <ImportStatusChip status={current.status} />
              <VerifiedBadge verified={current.verified} />
            </span>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            {isProcessing(current.status)
              ? "Reading the file and checking it against the account. This takes a few seconds."
              : current.status === "failed_validation"
                ? current.error ?? "The statement failed its checks, so nothing was imported. Open it to see which check and the rows that were read."
                : `${current.lineCount} lines read${current.periodFrom ? `, ${day(current.periodFrom)} to ${day(current.periodTo)}` : ""}; ${current.newLineCount} new. Review them next.`}
          </p>
          {!isProcessing(current.status) && (
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <ButtonLink href={`/suite/finance/banking/imports/${current.id}`} size="sm" variant={current.status === "failed_validation" ? "secondary" : "primary"} icon={ArrowRight}>
                {current.status === "failed_validation" ? "See what was read" : "Review statement"}
              </ButtonLink>
              <RetryImportButton statement={current} allowed={canRetry} onRetried={setCurrent} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
