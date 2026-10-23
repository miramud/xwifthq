"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Check, Copy, Download, KeyRound, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { ApiError, mfa, type MfaSetup, type MfaStatus } from "@/lib/api/account-client";
import { OneTimeCodeInput } from "@/components/workspace/StepUpDialog";

/*
  My account › Security › Two-step verification.

  The authenticator app is asked for when approving a large request or
  releasing a payment schedule (the organisation sets the amount). Signing in
  does not use it. Everything here is the signed-in person's own: the secret
  is shown only while setting up, and backup codes only once, when made.
*/

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "off"; status: MfaStatus }
  | { kind: "setup"; setup: MfaSetup }
  | { kind: "codes"; codes: string[]; status: MfaStatus; fresh: "enabled" | "regenerated" }
  | { kind: "on"; status: MfaStatus; action: null | "disable" | "regenerate" };

const BTN_PRIMARY =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_DANGER =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-error-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-error-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500/40 disabled:cursor-not-allowed disabled:opacity-50";

function message(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const first = e.errors ? Object.values(e.errors).flat()[0] : undefined;
    return first ?? e.message ?? fallback;
  }
  return fallback;
}

function longDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function TwoStepVerification() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    mfa
      .status()
      .then((status) => setView(status.enabled ? { kind: "on", status, action: null } : { kind: "off", status }))
      .catch((e) => setView({ kind: "error", message: message(e, "Two-step verification didn't load.") }));
  }, []);

  useEffect(load, [load]);

  const guarded = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e, fallback));
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    guarded(async () => {
      const setup = await mfa.start();
      setView({ kind: "setup", setup });
    }, "Setup didn't start. Try again.");

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm" aria-labelledby="two-step-title">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
        <div>
          <h2 id="two-step-title" className="text-sm font-semibold text-neutral-900" style={{ fontFamily: "var(--font-heading)" }}>
            Two-step verification
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            A code from an authenticator app, asked for when you approve a large request or a payment schedule.
          </p>
        </div>
        {(view.kind === "on" || view.kind === "codes") && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mint-50 px-2.5 py-1 text-xs font-semibold text-mint-700">
            <ShieldCheck size={13} aria-hidden /> On
          </span>
        )}
        {view.kind === "off" && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
            <ShieldOff size={13} aria-hidden /> Off
          </span>
        )}
      </header>

      <div className="p-5">
        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-error-500/20 bg-error-500/5 px-3 py-2.5 text-sm text-error-700">
            {error}
          </p>
        )}

        {view.kind === "loading" && (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 size={16} className="animate-spin" aria-hidden /> Loading…
          </p>
        )}

        {view.kind === "error" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-error-700">{view.message}</p>
            <button type="button" className={BTN_SECONDARY} onClick={load}>
              Try again
            </button>
          </div>
        )}

        {view.kind === "off" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm text-neutral-600">
              {view.status.pending
                ? "You started setting this up but didn't finish. Start again to get a new QR code."
                : "Your organisation may ask for a code before large approvals go through. Set it up now so you are not held up later."}
            </p>
            <button type="button" className={BTN_PRIMARY} onClick={() => void start()} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Smartphone size={16} aria-hidden />}
              Set up two-step verification
            </button>
          </div>
        )}

        {view.kind === "setup" && (
          <SetupStep
            setup={view.setup}
            busy={busy}
            onCancel={load}
            onConfirm={(code) =>
              guarded(async () => {
                const r = await mfa.confirm(code);
                setView({ kind: "codes", codes: r.backupCodes, status: r, fresh: "enabled" });
              }, "That code didn't work. Try the newest one.")
            }
          />
        )}

        {view.kind === "codes" && (
          <BackupCodes
            codes={view.codes}
            fresh={view.fresh}
            onDone={() => setView({ kind: "on", status: view.status, action: null })}
          />
        )}

        {view.kind === "on" && (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-neutral-50 px-4 py-3">
                <dt className="text-xs text-neutral-500">On since</dt>
                <dd className="mt-0.5 font-medium text-neutral-900">{longDate(view.status.confirmedAt) || "-"}</dd>
              </div>
              <div className="rounded-xl bg-neutral-50 px-4 py-3">
                <dt className="text-xs text-neutral-500">Backup codes left</dt>
                <dd className={`mt-0.5 font-medium tabular-nums ${view.status.backupCodesLeft <= 2 ? "text-error-700" : "text-neutral-900"}`}>
                  {view.status.backupCodesLeft} of 10
                  {view.status.backupCodesLeft <= 2 && <span className="ml-1 font-normal">· make new ones</span>}
                </dd>
              </div>
            </dl>

            {view.action === null ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" className={BTN_SECONDARY} onClick={() => { setError(null); setView({ ...view, action: "regenerate" }); }}>
                  <KeyRound size={16} aria-hidden /> Make new backup codes
                </button>
                <button
                  type="button"
                  className={`${BTN_SECONDARY} text-error-700 hover:border-error-500/40 hover:bg-error-500/5`}
                  onClick={() => { setError(null); setView({ ...view, action: "disable" }); }}
                >
                  <ShieldOff size={16} aria-hidden /> Turn off
                </button>
              </div>
            ) : (
              <CodeConfirm
                key={view.action}
                title={view.action === "disable" ? "Turn off two-step verification" : "Make new backup codes"}
                hint={
                  view.action === "disable"
                    ? "Enter a code from your app, or a backup code. Approvals over your organisation's amount will then wait until you set it up again."
                    : "Enter a code from your app. Your old backup codes stop working."
                }
                confirmLabel={view.action === "disable" ? "Turn off" : "Make new codes"}
                danger={view.action === "disable"}
                allowBackup={view.action === "disable"}
                busy={busy}
                onCancel={() => { setError(null); setView({ ...view, action: null }); }}
                onConfirm={(code) =>
                  view.action === "disable"
                    ? guarded(async () => {
                        const status = await mfa.disable(code);
                        setView({ kind: "off", status });
                      }, "That code didn't work.")
                    : guarded(async () => {
                        const r = await mfa.regenerate(code);
                        setView({ kind: "codes", codes: r.backupCodes, status: r, fresh: "regenerated" });
                      }, "That code didn't work.")
                }
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SetupStep({
  setup,
  busy,
  onCancel,
  onConfirm,
}: {
  setup: MfaSetup;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (code: string) => void;
}) {
  const fieldId = useId();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret.replace(/\s/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* The key is on screen to type; nothing else to do. */
    }
  };

  return (
    <form
      className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6 && !busy) onConfirm(code);
      }}
    >
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URI made on the server */}
        <img src={setup.qr} alt="QR code to scan with your authenticator app" width={200} height={200} className="rounded-xl border border-neutral-200 bg-white p-2" />
      </div>

      <div className="min-w-0 space-y-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-neutral-700 marker:font-semibold marker:text-neutral-400">
          <li>Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
          <li>Scan the QR code, or type the key below.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>

        <div>
          <p className="mb-1 text-xs font-medium text-neutral-500">Key, if you can&apos;t scan</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-neutral-50 px-3 py-2 font-mono text-sm tracking-wide text-neutral-900">{setup.secret}</code>
            <button type="button" onClick={() => void copyKey()} className={BTN_SECONDARY} aria-label="Copy the key">
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            </button>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {copied ? "Key copied" : ""}
          </p>
        </div>

        <div>
          <label htmlFor={fieldId} className="mb-1.5 block text-xs font-medium text-neutral-600">
            6-digit code from the app
          </label>
          <OneTimeCodeInput id={fieldId} value={code} onChange={setCode} autoFocus label="6-digit code from the app" />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={BTN_SECONDARY} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={BTN_PRIMARY} disabled={code.length !== 6 || busy}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
            Turn on
          </button>
        </div>
      </div>
    </form>
  );
}

function BackupCodes({ codes, fresh, onDone }: { codes: string[]; fresh: "enabled" | "regenerated"; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Download is the fallback. */
    }
  };

  const download = () => {
    const blob = new Blob([`XwiftHQ backup codes\nEach code works once.\n\n${text}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "xwifthq-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <p role="status" className="rounded-lg border border-mint-500/25 bg-mint-50 px-3 py-2.5 text-sm text-mint-700">
        {fresh === "enabled" ? "Two-step verification is on." : "New backup codes made. The old ones no longer work."}
      </p>
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Save your backup codes</h3>
        <p className="mt-0.5 text-sm text-neutral-600">
          If you lose your phone, each code gets you through one approval. This is the only time they are shown.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 sm:grid-cols-5" aria-label="Backup codes">
        {codes.map((c) => (
          <li key={c} className="text-center font-mono text-sm font-semibold tracking-wide text-neutral-900">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className={BTN_SECONDARY} onClick={() => void copy()}>
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied ? "Copied" : "Copy codes"}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={download}>
          <Download size={16} aria-hidden /> Download as a file
        </button>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 rounded border-neutral-300" />
        I have saved these codes somewhere safe
      </label>
      <button type="button" className={BTN_PRIMARY} disabled={!saved} onClick={onDone}>
        Done
      </button>
    </div>
  );
}

function CodeConfirm({
  title,
  hint,
  confirmLabel,
  danger,
  allowBackup,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  hint: string;
  confirmLabel: string;
  danger?: boolean;
  allowBackup?: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (code: string) => void;
}) {
  const fieldId = useId();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const ready = backup ? code.replace(/[\s-]/g, "").length >= 8 : code.length === 6;

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) onConfirm(code.trim());
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <p className="mt-0.5 text-sm text-neutral-600">{hint}</p>
      </div>
      <div className="max-w-xs">
        <label htmlFor={fieldId} className="mb-1.5 block text-xs font-medium text-neutral-600">
          {backup ? "Backup code" : "6-digit code"}
        </label>
        <OneTimeCodeInput id={fieldId} value={code} onChange={setCode} backup={backup} autoFocus label={backup ? "Backup code" : "6-digit code"} />
      </div>
      {allowBackup && (
        <button
          type="button"
          onClick={() => { setBackup((b) => !b); setCode(""); }}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800"
        >
          <KeyRound size={14} aria-hidden />
          {backup ? "Use the code from my app" : "Use a backup code"}
        </button>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={BTN_SECONDARY} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={danger ? BTN_DANGER : BTN_PRIMARY} disabled={!ready || busy}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}
