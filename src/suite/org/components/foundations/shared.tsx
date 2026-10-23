"use client";

import { useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { ApiError, orgFoundations } from "@/lib/api/org-foundations-client";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ErrorNote } from "@/suite/lms/components/ui/ws";

/* Pieces the organisation foundations pages share. */

/** The API's own words when it gave any (a 422 says exactly what to fix), or the fallback. */
export function errorText(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const first = e.errors ? Object.values(e.errors)[0]?.[0] : undefined;
    return first || e.message || fallback;
  }
  return fallback;
}

/** Field -> first message, from a 422. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.errors) return {};
  return Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0] ?? ""]));
}

/* --------------------------- people lookup -------------------------- */

interface PeopleState {
  status: "idle" | "loading" | "ready" | "error";
  options: SelectOption[];
}

const IDLE: PeopleState = { status: "idle", options: [] };
let people: PeopleState = IDLE;
const listeners = new Set<() => void>();

function setPeople(next: PeopleState) {
  people = next;
  listeners.forEach((l) => l());
}

function loadPeople() {
  if (people.status === "loading" || people.status === "ready") return;
  setPeople({ status: "loading", options: [] });
  orgFoundations.lookups
    .people()
    .then((rows) =>
      setPeople({
        status: "ready",
        options: rows.map((p) => ({ value: p.id, label: p.name, hint: [p.jobTitle, p.unit].filter(Boolean).join(" · ") || undefined })),
      }),
    )
    .catch(() => setPeople({ status: "error", options: [] }));
}

/** For tests: forget the loaded list. */
export function resetPeople() {
  setPeople(IDLE);
}

/** Everybody in the organisation, loaded once per visit for every picker that asks. */
export function usePeople(): PeopleState {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => people,
    () => IDLE,
  );
  useEffect(() => {
    if (state.status === "idle") loadPeople();
  }, [state.status]);
  return state;
}

export function PersonSelect({
  id,
  value,
  onChange,
  placeholder = "Choose a person",
  clearable,
  invalid,
  describedBy,
  exclude,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
  describedBy?: string;
  exclude?: string[];
}) {
  const state = usePeople();
  const options = exclude?.length ? state.options.filter((o) => !exclude.includes(o.value)) : state.options;
  return (
    <SearchableSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      clearable={clearable}
      placeholder={state.status === "loading" ? "Loading people…" : placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      searchPlaceholder="Search people"
      noOptionsText={state.status === "error" ? "People didn't load. Reload the page to try again." : "Loading people…"}
    />
  );
}

/** Several people: chips with a remove button, and a picker to add another. */
export function PeoplePicker({
  id,
  values,
  onChange,
  addLabel = "Add a person",
}: {
  id?: string;
  values: string[];
  onChange: (v: string[]) => void;
  addLabel?: string;
}) {
  const state = usePeople();
  const name = (v: string) => state.options.find((o) => o.value === v)?.label ?? "Someone";
  return (
    <div>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Chosen people">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-3 pr-1 text-xs font-semibold text-primary-700">
              {name(v)}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${name(v)}`}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full hover:bg-primary-100"
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
        placeholder={state.status === "loading" ? "Loading people…" : addLabel}
        searchPlaceholder="Search people"
        noOptionsText={state.status === "loading" ? "Loading people…" : "Nobody more to add."}
      />
    </div>
  );
}

/* ------------------------------ messages ---------------------------- */

/** A success line, read out when it appears. */
export function Notice({ text }: { text: string | null }) {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {text ?? ""}
      </p>
      {text && <p className="mb-5 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">{text}</p>}
    </>
  );
}

/** A load failure with a way to try again. */
export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <ErrorNote className="mb-4">
      <span className="flex flex-wrap items-center justify-between gap-2">
        {text}
        <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer font-semibold underline underline-offset-2">
          Try again
        </button>
      </span>
    </ErrorNote>
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

export const CURRENCIES: SelectOption[] = [
  { value: "NGN", label: "NGN", hint: "Nigerian naira" },
  { value: "USD", label: "USD", hint: "US dollar" },
  { value: "EUR", label: "EUR", hint: "Euro" },
  { value: "GBP", label: "GBP", hint: "Pound sterling" },
  { value: "GHS", label: "GHS", hint: "Ghanaian cedi" },
  { value: "KES", label: "KES", hint: "Kenyan shilling" },
  { value: "ZAR", label: "ZAR", hint: "South African rand" },
  { value: "XOF", label: "XOF", hint: "West African CFA franc" },
  { value: "CAD", label: "CAD", hint: "Canadian dollar" },
  { value: "CNY", label: "CNY", hint: "Chinese yuan" },
  { value: "AED", label: "AED", hint: "UAE dirham" },
];

/** A currency picker that also takes any other three-letter code typed in. */
export function CurrencySelect({
  id,
  value,
  onChange,
  exclude,
  invalid,
  describedBy,
  clearable,
  placeholder = "Choose a currency",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  exclude?: string[];
  invalid?: boolean;
  describedBy?: string;
  clearable?: boolean;
  placeholder?: string;
}) {
  let options = CURRENCIES.filter((c) => !exclude?.includes(c.value));
  if (value && !options.some((o) => o.value === value)) options = [{ value, label: value }, ...options];
  return (
    <SearchableSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      clearable={clearable}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      searchPlaceholder="Search or type a code"
      onCreate={(text) => {
        const code = text.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(code)) throw new Error("Type a three-letter currency code, like USD.");
        return { value: code, label: code };
      }}
      createLabel={(text) => `Use ${text.trim().toUpperCase()}`}
    />
  );
}
