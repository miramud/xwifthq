"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/workspace/kit";
import { KeyRound, Copy, Check, Download, TriangleAlert, X } from "lucide-react";
import type { OneTimeCredential } from "@/lib/api/saas-client";

/**
 * The one moment in this product where closing a dialog destroys data.
 *
 * Generated passwords are hashed on the way into the database and never stored
 * in plaintext, so this response is the only time they will ever exist. The
 * design follows from that single fact:
 *
 *  • It cannot be dismissed casually. No backdrop click, no bare Escape: both
 *    route through the same confirmation as the close button, because a stray
 *    click here costs the admin a re-import.
 *  • "Done" stays disabled until the admin ticks that they have saved them.
 *    A deliberately obstructive control is the right call when the alternative
 *    is silent, unrecoverable loss.
 *  • Download and copy-all come before the list itself. Reading 40 passwords
 *    off a screen is not the job; getting them into a file is.
 */
export default function CredentialsDialog({
  credentials,
  title = "Learners created",
  onClose,
}: {
  credentials: OneTimeCredential[];
  title?: string;
  onClose: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedRow, setCopiedRow] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus into the dialog so a screen reader lands on the warning rather
  // than continuing to read the page behind it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const attemptClose = useCallback(() => {
    if (acknowledged) {
      onClose();
      return;
    }
    setConfirmingClose(true);
  }, [acknowledged, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        attemptClose();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attemptClose]);

  const asCsv = () =>
    ["name,email,temporary_password"]
      .concat(
        credentials.map((c) => `"${c.name}","${c.email}","${c.temporaryPassword}"`),
      )
      .join("\n");

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(asCsv());
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      /* clipboard blocked: the download below is the fallback */
    }
  };

  const copyRow = async (credential: OneTimeCredential) => {
    try {
      await navigator.clipboard.writeText(credential.temporaryPassword);
      setCopiedRow(credential.email);
      setTimeout(() => setCopiedRow(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const download = () => {
    const blob = new Blob([asCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `xwifthq-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);

    // Downloading is the safest possible acknowledgement: they now have the file.
    setAcknowledged(true);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain p-0 sm:p-4">
      {/* Strong scrim: this dialog must not compete with the page behind it,
          and the backdrop is deliberately not a dismiss target. */}
      <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm" aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credentials-title"
        className="relative mt-auto flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl sm:mb-auto sm:rounded-[1.5rem]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-mint-600 text-white shadow-lg shadow-mint-500/30">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="credentials-title"
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold text-neutral-900 outline-none"
              >
                {title}
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                {credentials.length} account{credentials.length === 1 ? "" : "s"} ready to hand out.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={attemptClose}
            aria-label="Close"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* The warning leads, because it changes what the admin does next. */}
        <div className="flex items-start gap-3 border-b border-warning-400/40 bg-warning-400/10 px-5 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-neutral-700">
            You see these passwords <strong>once</strong>. They are stored encrypted and cannot be
            retrieved or sent again, and there is no way to reset them. Download them now and share them
            with each learner securely.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-5 py-3">
          <button type="button" onClick={download} className={buttonClass("primary", "sm")}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download CSV
          </button>

          <button
            type="button"
            onClick={copyAll}
            className={buttonClass("secondary", "sm")}
          >
            {copiedAll ? (
              <>
                <Check className="h-4 w-4 text-success-600" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy all
              </>
            )}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Generated accounts and their one-time passwords
            </caption>
            <thead className="sticky top-0 bg-primary-50/60 text-xs uppercase tracking-wide text-neutral-500 backdrop-blur">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Learner
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Temporary password
                </th>
                <th scope="col" className="px-5 py-2.5">
                  <span className="sr-only">Copy</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {credentials.map((credential) => (
                <tr key={credential.email}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-neutral-800">{credential.name}</p>
                    <p className="text-xs text-neutral-500">{credential.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    {/* Tabular figures so the column does not jitter. */}
                    <code className="rounded-lg bg-neutral-100 px-2 py-1 font-mono text-xs tabular-nums text-neutral-700">
                      {credential.temporaryPassword}
                    </code>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => copyRow(credential)}
                      aria-label={`Copy password for ${credential.email}`}
                      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      {copiedRow === credential.email ? (
                        <Check className="h-4 w-4 text-success-600" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-neutral-200 p-5">
          {confirmingClose && !acknowledged && (
            <p
              role="alert"
              className="mb-3 rounded-2xl bg-error-500/5 px-4 py-3 text-sm text-error-700"
            >
              Save the passwords first. Once this closes they are gone for good.
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            I have saved these passwords somewhere safe.
          </label>

          <button
            type="button"
            onClick={onClose}
            disabled={!acknowledged}
            className={`${buttonClass("primary")} mt-4 w-full`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
