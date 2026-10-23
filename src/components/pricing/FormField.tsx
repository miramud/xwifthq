"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * A labelled input for the public forms (onboarding, sales requests).
 *
 * The label is a real `<label for>`, the hint and the error are tied to the
 * input with `aria-describedby`, and an error sets `aria-invalid` — a
 * placeholder is never the only thing telling somebody what a box is for.
 */
export const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-800 placeholder-neutral-400 transition-colors focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 aria-[invalid=true]:border-error-400";

export function FormField({
  id,
  label,
  hint,
  error,
  optional = false,
  children,
  ...input
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-neutral-700">
        {label}
        {optional && <span className="text-xs font-normal text-neutral-500">Optional</span>}
      </label>
      {children ?? (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={INPUT_CLASS}
          {...input}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-error-600">
          {error}
        </p>
      )}
    </div>
  );
}
