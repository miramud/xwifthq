"use client";

import { MODULE_COUNTS, PRICE_LISTS, type ModuleCount, type PriceList } from "@/lib/pricing/price-book";

/**
 * The two choices every price on the page depends on: which price list
 * (Nigeria in naira, Africa or International in dollars) and how many
 * modules. Both are pill radio groups, the same shape as the old currency
 * switch, so they read as one family wherever they appear.
 */

const SYMBOL: Record<PriceList, string> = { NG: "₦", AFR: "US$", INT: "US$" };

export function ListPicker({
  value,
  onChange,
  label = "Price list",
}: {
  value: PriceList;
  onChange: (list: PriceList) => void;
  label?: string;
}) {
  return (
    <Pills
      label={label}
      options={PRICE_LISTS.map((l) => ({ value: l.key, text: `${l.label} (${SYMBOL[l.key]})` }))}
      value={value}
      onChange={onChange}
    />
  );
}

export function ModulePicker({
  value,
  onChange,
  label = "Modules",
}: {
  value: ModuleCount;
  onChange: (count: ModuleCount) => void;
  label?: string;
}) {
  return (
    <Pills
      label={label}
      options={MODULE_COUNTS.map((c) => ({
        value: c,
        text: c === 5 ? "All 5" : String(c),
        name: c === 5 ? "All 5 modules" : `${c} ${c === 1 ? "module" : "modules"}`,
      }))}
      value={value}
      onChange={onChange}
    />
  );
}

function Pills<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; text: string; name?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex max-w-full flex-wrap justify-center rounded-full border border-primary-100 bg-white p-1 shadow-[0_10px_30px_-18px_rgb(150_56_205/0.5)]"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            aria-label={o.name}
            onClick={() => onChange(o.value)}
            className={`min-h-11 min-w-11 rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
              value === o.value ? "bg-primary-600 text-white" : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}
