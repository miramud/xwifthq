"use client";

import { Button, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { hintCls, labelCls } from "./kit";

/*
  Form furniture for the leave, roster and attendance dialogs: a labelled
  field whose hint is a description rather than part of its name, a checkbox
  row, a row of day toggles, and the cancel/submit pair.
*/

export function FormField({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className={hintCls}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function CheckField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors",
        checked ? "border-primary-200 bg-primary-50/60" : "border-neutral-200 bg-white hover:bg-neutral-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 accent-primary-600"
      />
      <span className="min-w-0">
        <span className="block font-semibold text-neutral-800">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
      </span>
    </label>
  );
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Seven toggles, ISO numbered (Monday is 1). */
export function DayToggles({
  value,
  onChange,
  label,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {DAY_NAMES.map((name, index) => {
        const iso = index + 1;
        const on = value.includes(iso);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((d) => d !== iso) : [...value, iso])}
            className={cx(
              "h-10 min-w-[48px] cursor-pointer rounded-xl border px-3 text-[13px] font-semibold transition-colors",
              on
                ? "border-primary-300 bg-primary-50 text-primary-700"
                : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50",
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

export function FormButtons({
  onCancel,
  submitLabel,
  busy,
  busyLabel = "Saving…",
  disabled = false,
  cancelLabel = "Cancel",
}: {
  onCancel: () => void;
  submitLabel: string;
  busy: boolean;
  busyLabel?: string;
  disabled?: boolean;
  cancelLabel?: string;
}) {
  return (
    <>
      <Button onClick={onCancel}>{cancelLabel}</Button>
      <Button type="submit" variant="primary" disabled={busy || disabled}>
        {busy ? busyLabel : submitLabel}
      </Button>
    </>
  );
}

/**
 * A heading row for a collection that sits straight on the canvas. A DataView
 * already draws its own card, so wrapping it in a Panel draws a card in a card.
 */
export function SectionHead({
  title,
  subtitle,
  icon: Icon,
  hue = "blue",
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: import("lucide-react").LucideIcon;
  hue?: import("@/components/workspace/modules").Hue;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)}>
            <Icon size={19} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
