"use client";

import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/components/workspace/kit";

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  /** The accessible name when the visible label is a short form of it ("Reports" → "My reports"). */
  name?: string;
  /** Shown but not choosable: the reason goes in `note`. */
  unavailable?: boolean;
  /** A tooltip and accessible description: "Nothing more in this feature". */
  note?: string;
  /** A small trailing mark, e.g. a clock on a scope that doesn't act yet. */
  icon?: LucideIcon;
}

/**
 * The kit's Segmented look as a real radio group: arrow keys move and select,
 * only the checked option (or the first one) is in the tab order, and an
 * option can be shown but unavailable with a reason. `value` may be null when
 * none applies, as for a feature whose keys add up to no one bundle.
 */
export function SegmentedRadio<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  size = "md",
  tone = "primary",
  className,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
  /** `quiet` reads as secondary: lighter track, slate selection. */
  tone?: "primary" | "quiet";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const choosable = (o: SegmentOption<T>) => !disabled && !o.unavailable;
  const checkedIndex = options.findIndex((o) => o.key === value);
  const tabIndexAt = checkedIndex >= 0 ? checkedIndex : Math.max(0, options.findIndex(choosable));

  const move = (from: number, step: 1 | -1) => {
    for (let i = 1; i <= options.length; i++) {
      const at = (from + step * i + options.length) % options.length;
      if (choosable(options[at])) {
        refs.current[at]?.focus();
        if (options[at].key !== value) onChange(options[at].key);
        return;
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(index, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(index, -1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(-1 + options.length, 1);
    } else if (e.key === "End") {
      e.preventDefault();
      move(0, -1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx(
        "flex flex-wrap rounded-xl p-0.5",
        tone === "primary" ? "bg-neutral-100" : "bg-neutral-100/70 ring-1 ring-inset ring-neutral-200/70",
        className,
      )}
    >
      {options.map((o, i) => {
        const on = o.key === value;
        const off = disabled || o.unavailable;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.name}
            aria-disabled={o.unavailable || undefined}
            disabled={disabled}
            tabIndex={i === tabIndexAt && !disabled ? 0 : -1}
            title={o.note}
            {...(o.note ? { "aria-description": o.note } : {})}
            onClick={() => {
              if (!off && !on) onChange(o.key);
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              "inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] font-semibold outline-none transition-[background-color,color,box-shadow] duration-150",
              "focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
              size === "sm" ? "h-8 px-2 text-xs" : "h-9 px-3 text-[13px]",
              on
                ? tone === "primary"
                  ? "bg-white text-primary-700 shadow-sm"
                  : "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600",
              on && off && "opacity-80",
              !on && off && "opacity-50",
              off ? "cursor-not-allowed" : !on && "cursor-pointer hover:bg-white/60 hover:text-neutral-900",
            )}
          >
            {o.label}
            {Icon && <Icon size={12} aria-hidden className={on ? "text-sun-700" : "text-neutral-500"} />}
          </button>
        );
      })}
    </div>
  );
}
