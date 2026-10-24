"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { ApiError } from "@/lib/api/hrm-client";
import { buttonClass } from "@/components/workspace/kit";

/**
 * The modal and form furniture the HR console keeps needing.
 *
 * Pulled out of the third copy. The duplicates had already started to drift,
 * one of them took an `onClose` it never called, so the dialog could not be
 * dismissed at all, and the fix had to be made twice.
 *
 * Two things every copy has to get right, which is the other reason they are
 * here rather than inline:
 *
 * **A dialog closes on Escape and on the backdrop.** Anything else traps
 * somebody in a form they opened by accident.
 *
 * **A label is not its hint.** Nesting both inside one `<label>` makes the
 * accessible name "First day Leave the year off if it never expires", which a
 * screen reader then reads in full every time focus lands on the field. The
 * hint belongs on `aria-describedby`.
 */
export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-neutral-900/40 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative mt-auto w-full rounded-[1.25rem] sm:mb-auto bg-white p-6 shadow-2xl shadow-neutral-900/10 ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <X size={18} aria-hidden />
        </button>
        <h3 className="pr-10 text-lg font-bold tracking-tight text-neutral-900">{title}</h3>
        {subtitle !== undefined && (
          <p className="mt-1 pr-10 text-sm text-neutral-500">{subtitle}</p>
        )}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export const INPUT =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100";

export const LABEL = "mb-1.5 block text-xs font-semibold text-neutral-700";

export const HINT = "mt-1 text-xs text-neutral-500";

/**
 * A labelled control.
 *
 * `htmlFor` rather than wrapping, so the hint describes the field instead of
 * becoming part of its name.
 */
export function Field({
  id,
  label,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className={HINT}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function FormActions({
  onCancel,
  submitLabel,
  saving,
  disabled = false,
  danger = false,
}: {
  onCancel: () => void;
  submitLabel: string;
  saving: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className={buttonClass("secondary", "md")}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving || disabled}
        className={buttonClass(danger ? "danger" : "primary", "md")}
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

/**
 * Submit handling, which every one of these forms was repeating.
 *
 * Returns the error as a string rather than throwing, because an HR form that
 * closes on a refusal loses what somebody typed, and the refusals here are
 * the interesting part ("that person is already being offboarded", "the
 * allegation has not been put to them yet"), not noise to swallow.
 */
export function useSubmit(onDone: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (
    event: React.FormEvent,
    action: () => Promise<unknown>,
  ) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await action();
      onDone();
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof Error
          ? e.message
          : "That did not save.",
      );
    } finally {
      setSaving(false);
    }
  };

  return { submit, saving, error };
}

export function ErrorNote({ error }: { error: string | null }) {
  if (error === null) return null;

  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
      <span>{error}</span>
    </p>
  );
}
