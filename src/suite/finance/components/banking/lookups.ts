"use client";

import { useEffect, useState } from "react";
import { banking } from "@/lib/api/finance-banking-client";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import { financeRequest } from "@/lib/api/finance-request";
import type { SelectOption } from "@/components/workspace/SearchableSelect";

/*
  The pickers the banking screens share - GL accounts, projects, cost
  centres, clients and vendors, people - loaded once per visit and handed to every
  picker that asks. A failed load is remembered as failed, so the picker
  can say so instead of looking empty.
*/

type Key = "accounts" | "projects" | "costCentres" | "counterparties" | "people";

export interface LookupState {
  status: "loading" | "ready" | "error";
  options: SelectOption[];
}

const ACCOUNT_TYPES: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Income",
  other_income: "Income",
  cost_of_revenue: "Cost of revenue",
  expense: "Expenses",
  other_expense: "Expenses",
};

/** Account id → the dimensions a line on it must carry, filled as accounts load. */
const requirements = new Map<string, string[]>();

/** What a line on this account must also carry (empty until accounts have loaded). */
export function requiredFor(accountId: string): string[] {
  return requirements.get(accountId) ?? [];
}

const LOADERS: Record<Key, () => Promise<SelectOption[]>> = {
  accounts: () =>
    banking.glAccounts().then((rows) => {
      rows.forEach((a) => requirements.set(a.id, a.requires ?? []));
      return rows
        .filter((a) => a.isPostable && a.active)
        .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}`, hint: a.currency ?? undefined, group: ACCOUNT_TYPES[a.type] ?? "Other" }));
    }),
  projects: () =>
    // Every project in the organisation, not just the ones the reader is on.
    financeRequest<{ data: { id: string; name: string; code: string | null }[] }>("lookups/projects").then((r) =>
      r.data.map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined })),
    ),
  costCentres: () => orgFoundations.lookups.costCentres().then((rows) => rows.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))),
  counterparties: () => orgFoundations.lookups.counterparties().then((rows) => rows.map((c) => ({ value: c.id, label: c.name, hint: c.code ?? undefined }))),
  // Colleagues, for accounts that need a person (staff advances, salary recoveries).
  people: () =>
    orgFoundations.lookups.people().then((rows) => rows.map((p) => ({ value: p.id, label: p.name, hint: [p.jobTitle, p.unit].filter(Boolean).join(" · ") || undefined }))),
};

const cache = new Map<Key, Promise<SelectOption[]>>();

function load(key: Key): Promise<SelectOption[]> {
  let p = cache.get(key);
  if (!p) {
    p = LOADERS[key]();
    // A failure is not cached: the next screen that asks tries again.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** For tests: forget everything loaded. */
export function resetLookups() {
  cache.clear();
  requirements.clear();
}

export function useLookup(key: Key): LookupState {
  const [state, setState] = useState<LookupState>({ status: "loading", options: [] });
  useEffect(() => {
    let alive = true;
    load(key).then(
      (options) => alive && setState({ status: "ready", options }),
      () => alive && setState({ status: "error", options: [] }),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}

/** What a picker says while its list loads, or when it failed. */
export function lookupText(state: LookupState, what: string): string {
  if (state.status === "loading") return `Loading ${what}…`;
  if (state.status === "error") return `${what[0].toUpperCase()}${what.slice(1)} didn't load. Reload the page to try again.`;
  return `No ${what} yet.`;
}
