"use client";

import { useId, useState } from "react";
import { cx } from "@/components/workspace/kit";
import { inputClass } from "@/suite/lms/components/ui/ws";

/*
  The period the company report covers. Presets are worked out from today;
  "Financial year to date" sends no dates at all, so the API's own financial
  year decides where it starts.
*/

export type PresetKey = "fy" | "month" | "lastMonth" | "quarter" | "ytd" | "last12" | "custom";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function presetRange(key: PresetKey, today = new Date()): { from: string; to: string } | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  const t = iso(today);
  switch (key) {
    case "month":
      return { from: iso(new Date(y, m, 1)), to: t };
    case "lastMonth":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "quarter":
      return { from: iso(new Date(y, m - (m % 3), 1)), to: t };
    case "ytd":
      return { from: iso(new Date(y, 0, 1)), to: t };
    case "last12": {
      const start = new Date(y - 1, m, today.getDate());
      start.setDate(start.getDate() + 1);
      return { from: iso(start), to: t };
    }
    default:
      return null;
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "fy", label: "Financial year to date" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "ytd", label: "Year to date" },
  { key: "last12", label: "Last 12 months" },
  { key: "custom", label: "Custom" },
];

/** Which preset the dates in the address are, or "custom". */
export function presetOf(from?: string, to?: string, today = new Date()): PresetKey {
  if (!from && !to) return "fy";
  for (const p of PRESETS) {
    const r = presetRange(p.key, today);
    if (r && r.from === from && r.to === to) return p.key;
  }
  return "custom";
}

export default function PeriodPicker({ from, to, onChange }: { from?: string; to?: string; onChange: (r: { from: string; to: string }) => void }) {
  const uid = useId();
  const matched = presetOf(from, to);
  const [custom, setCustom] = useState(matched === "custom");
  const active: PresetKey = custom ? "custom" : matched;

  const pick = (key: PresetKey) => {
    if (key === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    const r = presetRange(key);
    onChange(r ?? { from: "", to: "" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Report period" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {PRESETS.map((p) => {
          const on = p.key === active;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(p.key)}
              className={cx(
                "h-10 shrink-0 cursor-pointer whitespace-nowrap rounded-xl border px-3.5 text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                on ? "border-primary-600 bg-primary-600 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {active === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block" htmlFor={`${uid}-from`}>
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">From</span>
            <input
              id={`${uid}-from`}
              type="date"
              className={cx(inputClass, "h-10 w-[11rem]")}
              value={from ?? ""}
              max={to || undefined}
              onChange={(e) => onChange({ from: e.target.value, to: to ?? "" })}
            />
          </label>
          <label className="block" htmlFor={`${uid}-to`}>
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">To</span>
            <input
              id={`${uid}-to`}
              type="date"
              className={cx(inputClass, "h-10 w-[11rem]")}
              value={to ?? ""}
              min={from || undefined}
              onChange={(e) => onChange({ from: from ?? "", to: e.target.value })}
            />
          </label>
          <p className="pb-2.5 text-xs text-neutral-500">Leave either date empty to use the financial year&apos;s start or today.</p>
        </div>
      )}
    </div>
  );
}
