"use client";

import { useEffect, useSyncExternalStore } from "react";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import { financeRequest } from "@/lib/api/finance-request";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";

/*
  The pickers a journal line, or a report filter, uses for its dimensions:
  project, cost centre, client or vendor, person, unit. Each list loads once
  per visit, the first time a picker asks for it, and every picker on the
  page shares it.
*/

export type Dimension = "projectId" | "costCentreId" | "counterpartyId" | "personId" | "unitId";

export const DIMENSIONS: { key: Dimension; label: string; word: string }[] = [
  { key: "costCentreId", label: "Cost centre", word: "cost centre" },
  { key: "projectId", label: "Project", word: "project" },
  { key: "counterpartyId", label: "Client or vendor", word: "counterparty" },
  { key: "personId", label: "Person", word: "person" },
  { key: "unitId", label: "Unit", word: "unit" },
];

export const dimensionLabel = (d: Dimension) => DIMENSIONS.find((x) => x.key === d)?.label ?? d;

/** The account's `requires` words → the line fields they demand. */
export function requiredDimensions(requires: string[]): Dimension[] {
  return DIMENSIONS.filter((d) => requires.includes(d.word)).map((d) => d.key);
}

interface ListState {
  status: "idle" | "loading" | "ready" | "error";
  options: SelectOption[];
}

type Loaded = Dimension;

const IDLE: ListState = { status: "idle", options: [] };
const lists: Record<Loaded, ListState> = { projectId: IDLE, costCentreId: IDLE, counterpartyId: IDLE, personId: IDLE, unitId: IDLE };
const listeners = new Set<() => void>();

const LOADERS: Record<Loaded, () => Promise<SelectOption[]>> = {
  costCentreId: () =>
    orgFoundations.lookups.costCentres().then((r) => r.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))),
  counterpartyId: () =>
    orgFoundations.lookups.counterparties().then((r) => r.map((c) => ({ value: c.id, label: c.name, hint: c.code ?? undefined }))),
  personId: () =>
    orgFoundations.lookups
      .people()
      .then((r) => r.map((p) => ({ value: p.id, label: p.name, hint: [p.jobTitle, p.unit].filter(Boolean).join(" · ") || undefined }))),
  unitId: () => orgFoundations.lookups.units().then((r) => r.map((u) => ({ value: u.id, label: u.name, hint: u.code }))),
  // The projects list is narrowed to the projects this person is on.
  projectId: () =>
    // Every project in the organisation, not just the ones the reader is on.
    financeRequest<{ data: { id: string; name: string; code: string | null }[] }>("lookups/projects").then((r) =>
      r.data.map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined })),
    ),
};

function set(kind: Loaded, next: ListState) {
  lists[kind] = next;
  listeners.forEach((l) => l());
}

function load(kind: Loaded) {
  if (lists[kind].status === "loading" || lists[kind].status === "ready") return;
  set(kind, { status: "loading", options: [] });
  LOADERS[kind]()
    .then((options) => set(kind, { status: "ready", options }))
    .catch(() => set(kind, { status: "error", options: [] }));
}

/** For tests: forget every loaded list. */
export function resetDimensionLists() {
  (Object.keys(lists) as Loaded[]).forEach((k) => (lists[k] = IDLE));
  listeners.forEach((l) => l());
}

function useList(kind: Loaded, enabled: boolean): ListState {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => lists[kind],
    () => IDLE,
  );
  useEffect(() => {
    if (enabled && state.status === "idle") load(kind);
  }, [enabled, kind, state.status]);
  return state;
}

/** One dimension's options, loaded the first time anything asks. */
export function useDimensionOptions(kind: Dimension, enabled = true): ListState {
  return useList(kind, enabled);
}

export function DimensionSelect({
  kind,
  id,
  value,
  onChange,
  required,
  invalid,
  describedBy,
  size = "md",
  placeholder,
}: {
  kind: Dimension;
  id?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  size?: "sm" | "md";
  placeholder?: string;
}) {
  const state = useDimensionOptions(kind);
  const label = dimensionLabel(kind).toLowerCase();
  let options = state.options;
  if (value && !options.some((o) => o.value === value)) options = [{ value, label: "Chosen earlier" }, ...options];
  return (
    <SearchableSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      size={size}
      clearable={!required}
      clearLabel={`No ${label}`}
      required={required}
      placeholder={state.status === "loading" ? "Loading…" : (placeholder ?? `Choose a ${label}`)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      searchPlaceholder={`Search ${label}s`}
      noOptionsText={
        state.status === "error"
          ? `The ${label} list didn't load. Reload the page to try again.`
          : state.status === "ready"
            ? `No ${label}s set up yet.`
            : "Loading…"
      }
    />
  );
}
