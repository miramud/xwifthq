"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { ApiError } from "@/lib/api/admin-client";
import { buttonClass, cx } from "./kit";

/**
 * Step-up verification: the authenticator code asked for before approving a
 * large request or a payment schedule (the organisation sets the amount).
 *
 * Laravel answers a refusal with a machine `code`:
 *  - `MFA_REQUIRED` (428) - send a code;
 *  - `MFA_NOT_ENROLLED` (428) - this person has no authenticator yet;
 *  - `MFA_INVALID` (422) - wrong, expired or already used;
 *  - `MFA_RATE_LIMITED` (429) - too many wrong codes, wait.
 */

export type StepUpReason = "MFA_REQUIRED" | "MFA_NOT_ENROLLED" | "MFA_INVALID" | "MFA_RATE_LIMITED";

/** Where somebody sets up their authenticator app. */
export const ENROL_HREF = "/account?tab=security";

/** The step-up reason an error carries, or null for any other error. */
export function stepUpReason(e: unknown): StepUpReason | null {
  if (!(e instanceof ApiError)) return null;
  const code = e.code;
  return code === "MFA_REQUIRED" || code === "MFA_NOT_ENROLLED" || code === "MFA_INVALID" || code === "MFA_RATE_LIMITED" ? code : null;
}

/**
 * The code field: one real input (so paste, autofill from the phone's SMS/OTP
 * bar and screen readers all just work), with six ticks under it that fill as
 * digits arrive - the remainder hatched, as everywhere in the workspace.
 * `backup` switches it to a backup code ("k7mq-x2vd").
 */
export function OneTimeCodeInput({
  id,
  value,
  onChange,
  backup = false,
  invalid,
  describedBy,
  autoFocus,
  label = "Verification code",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  backup?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus, backup]);

  const digits = value.replace(/\D/g, "").length;

  return (
    <div>
      <input
        ref={ref}
        id={id}
        aria-label={id ? undefined : label}
        value={value}
        onChange={(e) => onChange(backup ? e.target.value.slice(0, 20) : e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode={backup ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        pattern={backup ? undefined : "[0-9]{6}"}
        maxLength={backup ? 20 : 6}
        placeholder={backup ? "xxxx-xxxx" : "000000"}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cx(
          "h-14 w-full rounded-xl border bg-white px-4 text-center font-mono text-2xl font-semibold tabular-nums text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:ring-4",
          backup ? "tracking-[0.2em]" : "tracking-[0.5em] indent-[0.5em]",
          invalid ? "border-error-500 focus:ring-error-500/15" : "border-neutral-200 focus:border-primary-400 focus:ring-primary-100",
        )}
      />
      {!backup && (
        <div className="mt-2 grid grid-cols-6 gap-1.5" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={cx("h-1.5 rounded-full transition-colors", i < digits ? "bg-primary-600" : "ws-hatch bg-neutral-100")} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StepUpDialog({
  title,
  summary,
  actionLabel,
  enrolled,
  onSubmit,
  onCancel,
}: {
  title: string;
  /** What is being approved, in a line: amount, reference. */
  summary?: React.ReactNode;
  /** The button: "Approve", "Approve schedule". */
  actionLabel: string;
  /** False when we already know there is no authenticator; null/undefined when unknown (the server will say). */
  enrolled?: boolean | null;
  /** Resolves on success (the caller closes the dialog); throws the API error otherwise. */
  onSubmit: (code: string) => Promise<void>;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const errorId = useId();
  const fieldId = useId();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notEnrolled, setNotEnrolled] = useState(enrolled === false);
  // The caller may learn it after opening (a status call still in flight).
  useEffect(() => {
    if (enrolled === false) setNotEnrolled(true);
  }, [enrolled]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const ready = backup ? code.replace(/[\s-]/g, "").length >= 8 : code.length === 6;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(code.trim());
    } catch (e) {
      const reason = stepUpReason(e);
      if (reason === "MFA_NOT_ENROLLED") setNotEnrolled(true);
      if (reason === "MFA_INVALID") setCode("");
      setError(e instanceof Error ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain bg-neutral-900/45 p-4 backdrop-blur-[2px] animate-fade-in"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      {/* Rendered beside the page, so it opts into the workspace tokens itself (see ConfirmDialog). */}
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onSubmit={submit}
        style={{ background: "white" }}
        className="ws mt-auto w-full max-w-md rounded-[1.25rem] p-6 shadow-2xl shadow-neutral-900/15 sm:mb-auto"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600" aria-hidden>
            <ShieldCheck size={20} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-neutral-900">
              {title}
            </h2>
            <p id={bodyId} className="mt-1.5 text-sm leading-relaxed text-neutral-600">
              {notEnrolled
                ? "This needs a code from an authenticator app, and you haven't set one up yet."
                : backup
                  ? "Type one of the backup codes you saved when you set up two-step verification. Each works once."
                  : "Open your authenticator app and type the 6-digit code it shows for XwiftHQ."}
            </p>
            {summary && <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-800 tabular-nums">{summary}</p>}
          </div>
        </div>

        {notEnrolled ? (
          <div className="mt-5 rounded-2xl border border-sun-500/30 bg-sun-50 p-4 text-sm text-sun-700">
            <p className="flex items-center gap-2 font-semibold">
              <Smartphone size={16} aria-hidden /> Set up two-step verification first
            </p>
            <p className="mt-1 text-sun-700">
              It takes a minute: scan a QR code with Google Authenticator, Microsoft Authenticator or similar, then come back and approve.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-neutral-700">
              {backup ? "Backup code" : "6-digit code"}
            </label>
            <OneTimeCodeInput
              id={fieldId}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              backup={backup}
              invalid={Boolean(error)}
              describedBy={error ? errorId : undefined}
              autoFocus
              label={backup ? "Backup code" : "6-digit code"}
            />
            <button
              type="button"
              onClick={() => {
                setBackup((b) => !b);
                setCode("");
                setError(null);
              }}
              className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-sm font-semibold text-primary-700 outline-none hover:text-primary-800 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <KeyRound size={14} aria-hidden />
              {backup ? "Use the code from my app" : "Use a backup code"}
            </button>
          </div>
        )}

        {error && !notEnrolled && (
          <p id={errorId} role="alert" className="mt-3 text-sm text-error-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className={buttonClass("secondary", "md")}>
            Cancel
          </button>
          {notEnrolled ? (
            <Link href={ENROL_HREF} className={buttonClass("primary", "md")}>
              <Smartphone size={17} aria-hidden /> Set up two-step verification
            </Link>
          ) : (
            <button type="submit" disabled={!ready || busy} className={buttonClass("primary", "md")}>
              {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <ShieldCheck size={17} aria-hidden />}
              {actionLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
