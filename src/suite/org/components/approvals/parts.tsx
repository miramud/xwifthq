"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { PageHeader, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { inputClass } from "@/suite/lms/components/ui/ws";
import { koboToNaira, nairaToKobo } from "./policy-logic";
import { labelFor, useLookup, type LookupKey } from "./lookups";

/* Shared pieces for the approval setup pages. */

export type ApprovalsTab = "processes" | "roles" | "authority" | "doa" | "oversight";

const TABS: { key: ApprovalsTab; label: string; href: string }[] = [
  { key: "processes", label: "Processes", href: "/suite/org/approvals" },
  { key: "roles", label: "Approval roles", href: "/suite/org/approvals/roles" },
  { key: "authority", label: "Authority", href: "/suite/org/approvals/authority" },
  { key: "doa", label: "DoA matrix", href: "/suite/org/approvals/doa" },
  { key: "oversight", label: "Oversight", href: "/suite/org/approvals/oversight" },
];

const SUBTITLE: Record<ApprovalsTab, string> = {
  processes: "Which requests need approval here, and the rules that decide who approves them.",
  roles: "Named positions approvals route to, and who holds each one today.",
  authority: "How much each person or role may approve, committees, and cover for people away.",
  doa: "The organisation's delegation of authority, written out from the rules in force.",
  oversight: "Every request in flight: what is stuck, what is late, and who it is waiting on.",
};

export function ApprovalsHeader({ active, actions }: { active: ApprovalsTab; actions?: React.ReactNode }) {
  return (
    <PageHeader
      eyebrow="Institution"
      title="Approvals"
      subtitle={SUBTITLE[active]}
      actions={actions}
      tabs={TABS}
      activeTab={active}
    />
  );
}

/** A message under a control, read out when it appears. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-error-700">
      {message}
    </p>
  );
}

/** A searchable dropdown over one of the shared lookups. */
export function LookupSelect({
  lookup,
  value,
  onChange,
  id,
  placeholder,
  clearable,
  invalid,
  describedBy,
  ariaLabel,
  size,
  exclude,
}: {
  lookup: LookupKey;
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
  size?: "sm" | "md";
  exclude?: string[];
}) {
  const state = useLookup(lookup);
  let options = state.options;
  if (exclude?.length) options = options.filter((o) => !exclude.includes(o.value) || o.value === value);
  // A saved value that isn't on the list (retired, or still loading) is still shown.
  if (value && !options.some((o) => o.value === value)) options = [{ value, label: value, hint: "Not on the list" }, ...options];
  return (
    <SearchableSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={state.status === "loading" ? "Loading…" : placeholder ?? "Choose"}
      clearable={clearable}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      size={size}
      noOptionsText={state.status === "error" ? "This list didn't load. Reload the page to try again." : state.status === "loading" ? "Loading…" : "Nothing to choose yet."}
    />
  );
}

/** Several values from one lookup: chips with a remove button, and a picker to add. */
export function MultiLookup({
  lookup,
  values,
  onChange,
  id,
  addLabel,
  invalid,
  describedBy,
}: {
  lookup: LookupKey;
  values: string[];
  onChange: (v: string[]) => void;
  id?: string;
  addLabel: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const state = useLookup(lookup);
  return (
    <div>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Chosen">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-3 pr-1 text-xs font-semibold text-primary-700">
              {labelFor(state.options, v)}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${labelFor(state.options, v)}`}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full hover:bg-primary-100"
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <SearchableSelect
        id={id}
        value=""
        onChange={(v) => v && !values.includes(v) && onChange([...values, v])}
        options={state.options.filter((o) => !values.includes(o.value))}
        placeholder={state.status === "loading" ? "Loading…" : addLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        noOptionsText={state.status === "loading" ? "Loading…" : "Nothing more to add."}
      />
    </div>
  );
}

/** Free-text list values (for "is one of" on a text field): type and press Enter. */
export function TagInput({
  values,
  onChange,
  id,
  options,
  placeholder = "Type a value and press Enter",
  invalid,
  describedBy,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  id?: string;
  options?: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [text, setText] = useState("");
  if (options && options.length > 0) {
    return (
      <div>
        {values.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Chosen">
            {values.map((v) => (
              <li key={v} className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-3 pr-1 text-xs font-semibold text-primary-700">
                {labelFor(options, v)}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  aria-label={`Remove ${labelFor(options, v)}`}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full hover:bg-primary-100"
                >
                  <X size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <SearchableSelect
          id={id}
          value=""
          onChange={(v) => v && !values.includes(v) && onChange([...values, v])}
          options={options.filter((o) => !values.includes(o.value))}
          placeholder="Add a value"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      </div>
    );
  }
  const add = () => {
    const v = text.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setText("");
  };
  return (
    <div>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Chosen">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-3 pr-1 text-xs font-semibold text-primary-700">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full hover:bg-primary-100"
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={inputClass}
      />
    </div>
  );
}

/**
 * An amount typed in naira, held as kobo. The text is kept as typed while
 * somebody edits ("5,000." is on its way to a number) and tidied on blur.
 */
export function MoneyInput({
  value,
  onChange,
  id,
  invalid,
  describedBy,
  ariaLabel,
  placeholder = "0",
  className,
}: {
  value: number | null;
  onChange: (kobo: number | null) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState<{ shown: string; for: number | null }>({ shown: koboToNaira(value), for: value });
  // The value changed from outside (a reset, a reorder): show it.
  const shown = text.for === value ? text.shown : koboToNaira(value);
  const hintId = useId();
  const bad = shown.trim() !== "" && nairaToKobo(shown) === null;
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-500" aria-hidden>
        ₦
      </span>
      <input
        id={id}
        inputMode="decimal"
        value={shown}
        aria-label={ariaLabel}
        aria-invalid={invalid || bad || undefined}
        aria-describedby={[describedBy, bad ? hintId : null].filter(Boolean).join(" ") || undefined}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          const kobo = nairaToKobo(next);
          setText({ shown: next, for: kobo === null && next.trim() !== "" ? value : kobo });
          if (kobo !== null || next.trim() === "") onChange(kobo);
        }}
        onBlur={() => setText({ shown: koboToNaira(value), for: value })}
        className={cx(inputClass, "pl-8 tabular-nums")}
      />
      {bad && (
        <span id={hintId} className="mt-1 block text-xs text-error-700">
          Type an amount in naira, like 250,000 or 1,500.50.
        </span>
      )}
    </div>
  );
}

/** A plain labelled number input. */
export function NumberInput({
  value,
  onChange,
  id,
  min,
  max,
  invalid,
  describedBy,
  ariaLabel,
  placeholder,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  min?: number;
  max?: number;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value ?? ""}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className={cx(inputClass, "tabular-nums", className)}
    />
  );
}

export const smallLabel = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500";

/** "2026-10-05T09:00:00Z" -> "5 Oct 2026". */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
