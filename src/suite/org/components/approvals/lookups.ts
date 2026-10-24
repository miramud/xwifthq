"use client";

import { useEffect, useSyncExternalStore } from "react";
import { jobTitles } from "@/lib/api/job-titles-client";
import { roles as accessRoles } from "@/lib/api/roles-client";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import type { SelectOption } from "@/components/workspace/SearchableSelect";

/*
  The pickers the approval setup needs (people, units, cost centres,
  clients and vendors, approval roles, committees, job titles and access
  roles), loaded once per page visit and shared by every picker that asks.

  Each list loads only when the first picker for it mounts, so the roles page
  never fetches counterparties. `invalidate` drops one after a change (a role
  created on the roles tab must appear in the builder's role picker).
*/

export type LookupKey = "people" | "units" | "costCentres" | "counterparties" | "approvalRoles" | "committees" | "jobTitles" | "accessRoles";

interface LookupState {
  status: "idle" | "loading" | "ready" | "error";
  options: SelectOption[];
}

const IDLE: LookupState = { status: "idle", options: [] };
const states = new Map<LookupKey, LookupState>();
const listeners = new Set<() => void>();
const inflight = new Map<LookupKey, Promise<void>>();

function emit() {
  listeners.forEach((l) => l());
}

function set(key: LookupKey, state: LookupState) {
  states.set(key, state);
  emit();
}

/** Everybody in the organisation, from the lightweight people lookup any member can read. */
async function loadPeople(): Promise<SelectOption[]> {
  return (await orgFoundations.lookups.people()).map((p) => ({
    value: p.id,
    label: p.name,
    hint: [p.jobTitle, p.unit].filter(Boolean).join(" · ") || undefined,
  }));
}

const LOADERS: Record<LookupKey, () => Promise<SelectOption[]>> = {
  people: loadPeople,
  units: async () =>
    (await orgFoundations.lookups.units()).map((u) => ({ value: u.id, label: u.name, hint: `${u.code} · ${u.kind}` })),
  costCentres: async () => (await orgFoundations.lookups.costCentres()).map((c) => ({ value: c.id, label: c.name, hint: c.code })),
  counterparties: async () =>
    (await orgFoundations.lookups.counterparties()).map((c) => ({ value: c.id, label: c.name, hint: c.code ?? c.roles.join(", ") })),
  // Policies name a role by its code, so the code is the value.
  approvalRoles: async () =>
    (await orgFoundations.approvals.roles.list()).map((r) => ({
      value: r.code,
      label: r.name,
      hint: r.vacant ? `${r.code} · nobody holds it` : r.code,
    })),
  committees: async () =>
    (await orgFoundations.approvals.committees.list()).map((c) => ({ value: c.code, label: c.name, hint: `${c.code} · ${c.members.length} members, quorum ${c.quorum}` })),
  jobTitles: async () => (await jobTitles.list()).map((t) => ({ value: t.id, label: t.name })),
  accessRoles: async () => (await accessRoles.list()).map((r) => ({ value: r.id, label: r.name, hint: r.kind === "system" ? "Built-in" : "Custom" })),
};

export function loadLookup(key: LookupKey): Promise<void> {
  const current = states.get(key) ?? IDLE;
  if (current.status === "ready" || current.status === "loading") return inflight.get(key) ?? Promise.resolve();
  set(key, { status: "loading", options: current.options });
  const p = LOADERS[key]()
    .then((options) => set(key, { status: "ready", options }))
    .catch(() => set(key, { status: "error", options: [] }))
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Forget a list so the next picker reloads it. */
export function invalidateLookup(key: LookupKey) {
  states.delete(key);
  emit();
}

/** For tests: start every list from scratch. */
export function resetLookups() {
  states.clear();
  inflight.clear();
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLookup(key: LookupKey | null): LookupState {
  const state = useSyncExternalStore(
    subscribe,
    () => (key ? states.get(key) ?? IDLE : IDLE),
    () => IDLE,
  );
  useEffect(() => {
    if (key && state.status === "idle") void loadLookup(key);
  }, [key, state.status]);
  return state;
}

/** The lookup a resolver or holder parameter type reads from. */
export function lookupForParam(type: string): LookupKey | null {
  switch (type) {
    case "role":
      return "approvalRoles";
    case "user":
      return "people";
    case "unit":
      return "units";
    case "committee":
      return "committees";
    default:
      return null;
  }
}

/** The lookup a context field of this type picks from. */
export function lookupForField(type: string): LookupKey | null {
  switch (type) {
    case "unit":
      return "units";
    case "cost_centre":
      return "costCentres";
    case "counterparty":
      return "counterparties";
    case "user":
      return "people";
    default:
      return null;
  }
}

export function labelFor(options: SelectOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
