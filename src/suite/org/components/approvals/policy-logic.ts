/*
  The approval policy builder's logic, kept out of the components so it can be
  tested on its own: which comparisons suit which field, how naira typed by a
  person becomes the kobo the engine compares, what an empty condition or stage
  looks like, and where a 422's dotted error path belongs on screen.

  Everything here works on the API's own `PolicyDefinition` JSON. The builder
  edits that shape directly; nothing is translated on save.
*/

import type { ContextFieldDef } from "@/lib/api/approvals-client";
import type {
  Condition,
  PolicyDefinition,
  PolicyRule,
  ResolverInfo,
  ResolverSpec,
  StageSpec,
} from "@/lib/api/org-foundations-client";

/* ------------------------------------------------------------------ */
/*  Fields                                                             */
/* ------------------------------------------------------------------ */

export type FieldType = ContextFieldDef["type"] | "flag";

/** A field a condition can test: one of the process's, or a `flags.<name>` switch. */
export interface BuilderField {
  key: string;
  label: string;
  type: FieldType;
  options: { value: string; label: string }[];
}

export const FLAG_PREFIX = "flags.";

export function isFlag(key: string): boolean {
  return key.startsWith(FLAG_PREFIX);
}

/** "flags.urgent" -> "Urgent"; "flags.SPLIT_SUSPECTED" -> "Split suspected". */
export function flagLabel(key: string): string {
  const name = key.slice(FLAG_PREFIX.length).replace(/[_-]+/g, " ").trim().toLowerCase();
  return name ? name[0].toUpperCase() + name.slice(1) : "Flag";
}

/** The process's fields plus every flag the policy already tests. */
export function builderFields(fields: ContextFieldDef[], definition: PolicyDefinition | null): BuilderField[] {
  const out: BuilderField[] = fields.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? [] }));
  for (const key of flagsUsed(definition)) {
    out.push({ key, label: `Flag: ${flagLabel(key)}`, type: "flag", options: [] });
  }
  return out;
}

/** Every `flags.<name>` field any rule or bypass of the definition tests. */
export function flagsUsed(definition: PolicyDefinition | null): string[] {
  if (!definition) return [];
  const seen = new Set<string>();
  const walk = (c: Condition | undefined) => {
    if (!c) return;
    if ("all" in c) c.all.forEach(walk);
    else if ("any" in c) c.any.forEach(walk);
    else if ("not" in c) walk(c.not);
    else if ("field" in c && isFlag(c.field)) seen.add(c.field);
  };
  definition.rules.forEach((r) => walk(r.when));
  definition.bypass.forEach((b) => walk(b.when));
  return [...seen].sort();
}

/* ------------------------------------------------------------------ */
/*  Operators                                                          */
/* ------------------------------------------------------------------ */

export type Op = "eq" | "ne" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte" | "between" | "exists" | "contains" | "within";

export const OP_LABEL: Record<Op, string> = {
  eq: "is",
  ne: "is not",
  in: "is one of",
  not_in: "is none of",
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  between: "is between",
  exists: "is filled in or empty",
  contains: "includes",
  within: "is in or under",
};

/** The comparisons that make sense for a field of this type, most useful first. */
export function opsFor(type: FieldType): Op[] {
  switch (type) {
    case "money":
    case "number":
      return ["gt", "gte", "lt", "lte", "between", "eq", "ne", "exists"];
    case "enum":
    case "text":
    case "cost_centre":
    case "counterparty":
    case "user":
      return ["eq", "ne", "in", "not_in", "exists"];
    case "unit":
      return ["within", "eq", "ne", "in", "not_in", "exists"];
    case "project_list":
    case "list":
      return ["contains", "exists"];
    case "boolean":
    case "flag":
      return ["eq"];
  }
}

/** A value of the right shape for this field and comparison, so the condition is never malformed. */
export function defaultValue(type: FieldType, op: Op): unknown {
  if (op === "exists") return true;
  if (op === "in" || op === "not_in") return [];
  if (op === "between") return [0, 0];
  if (type === "boolean" || type === "flag") return true;
  if (type === "money" || type === "number") return 0;
  return "";
}

/** Keeps the value when it still fits the new comparison; otherwise starts afresh. */
export function coerceValue(type: FieldType, op: Op, previous: unknown): unknown {
  const fresh = defaultValue(type, op);
  if (Array.isArray(fresh) !== Array.isArray(previous)) {
    // A single value moving into a list keeps it as the list's first entry.
    if ((op === "in" || op === "not_in") && previous !== "" && previous != null && !Array.isArray(previous)) return [previous];
    return fresh;
  }
  if (op === "between") return Array.isArray(previous) && previous.length === 2 ? previous : fresh;
  if (op === "exists") return typeof previous === "boolean" ? previous : fresh;
  return typeof previous === typeof fresh ? previous : fresh;
}

/* ------------------------------------------------------------------ */
/*  Money                                                              */
/* ------------------------------------------------------------------ */

/**
 * "₦5,000,000.50" -> 500000050. Exact: the naira and kobo parts are read as
 * integers, never through a float, so 0.29 is 29 kobo and not 28.999….
 * Returns null for text that isn't an amount.
 */
export function nairaToKobo(text: string): number | null {
  const clean = text.replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  if (clean === "") return null;
  const m = /^(-)?(\d*)(?:\.(\d{0,2}))?$/.exec(clean);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) return null;
  const naira = m[2] === "" ? 0 : Number(m[2]);
  const kobo = Number(((m[3] ?? "") + "00").slice(0, 2));
  const total = naira * 100 + kobo;
  return m[1] ? -total : total;
}

/** 500000050 -> "5,000,000.50"; whole naira print without kobo. */
export function koboToNaira(kobo: number | null | undefined): string {
  if (kobo == null || !Number.isFinite(kobo)) return "";
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(Math.round(kobo));
  const naira = Math.floor(abs / 100).toLocaleString("en-NG");
  const rest = abs % 100;
  return `${sign}${naira}${rest === 0 ? "" : `.${String(rest).padStart(2, "0")}`}`;
}

/* ------------------------------------------------------------------ */
/*  Building blocks                                                    */
/* ------------------------------------------------------------------ */

export type GroupKind = "all" | "any";

export function isGroup(c: Condition): c is { all: Condition[] } | { any: Condition[] } {
  return "all" in c || "any" in c;
}

export function groupKind(c: Condition): GroupKind | null {
  return "all" in c ? "all" : "any" in c ? "any" : null;
}

export function groupItems(c: Condition): Condition[] {
  return "all" in c ? c.all : "any" in c ? c.any : [];
}

export function makeGroup(kind: GroupKind, items: Condition[]): Condition {
  return kind === "all" ? { all: items } : { any: items };
}

/** A comparison on the first field, ready to edit. */
export function newComparison(fields: BuilderField[]): Condition {
  const f = fields[0];
  if (!f) return { field: "", op: "eq", value: "" };
  const op = opsFor(f.type)[0];
  return { field: f.key, op, value: defaultValue(f.type, op) };
}

export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item";
  if (!used.has(root)) return root;
  for (let i = 2; ; i++) {
    const next = `${root}-${i}`;
    if (!used.has(next)) return next;
  }
}

/** A resolver spec with every parameter its kind asks for, blank. */
export function resolverFor(kind: string, resolvers: ResolverInfo[], previous?: ResolverSpec | null): ResolverSpec {
  const info = resolvers.find((r) => r.kind === kind);
  const out: ResolverSpec = { kind };
  for (const param of Object.keys(info?.params ?? {})) {
    out[param] = previous && previous.kind === kind ? previous[param] ?? "" : "";
  }
  return out;
}

export function newStage(rule: PolicyRule, resolvers: ResolverInfo[]): StageSpec {
  const highest = rule.stages.reduce((m, s) => Math.max(m, s.order), 0);
  const kind = resolvers[0]?.kind ?? "role";
  return {
    key: uniqueSlug(`stage-${rule.stages.length + 1}`, rule.stages.map((s) => s.key)),
    name: "",
    order: Math.min(999, highest + 10),
    type: "approval",
    completion: "one",
    quorum: null,
    resolver: resolverFor(kind, resolvers),
    fallback: null,
    slaHours: null,
    parallelGroup: null,
    distinctPerson: false,
    canAmend: [],
  };
}

export function newRule(definition: PolicyDefinition): PolicyRule {
  const n = definition.rules.length + 1;
  return {
    id: uniqueSlug(`rule-${n}`, definition.rules.map((r) => r.id)),
    label: `Rule ${n}`,
    when: { always: true },
    stages: [],
  };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/* ------------------------------------------------------------------ */
/*  Errors by path                                                     */
/* ------------------------------------------------------------------ */

export type FieldErrors = Record<string, string[]>;

/** The first message for exactly this path. */
export function errorAt(errors: FieldErrors | null | undefined, path: string): string | undefined {
  return errors?.[path]?.[0];
}

/** True when anything at or below this path is wrong (to mark a collapsed card). */
export function hasErrorUnder(errors: FieldErrors | null | undefined, path: string): boolean {
  if (!errors) return false;
  return Object.keys(errors).some((k) => k === path || k.startsWith(`${path}.`));
}

/**
 * The validator's paths address the definition it was sent; a 422 for the
 * whole PATCH may also carry `definition.` in front. Both read the same.
 */
export function normaliseErrors(errors: FieldErrors | null | undefined): FieldErrors {
  const out: FieldErrors = {};
  for (const [k, v] of Object.entries(errors ?? {})) {
    const key = k.startsWith("definition.") ? k.slice("definition.".length) : k;
    out[key] = [...(out[key] ?? []), ...v];
  }
  return out;
}

/** "rules.0.stages.1.resolver.role" -> "Rule 1 › stage 2 › approver". For the error summary. */
export function describePath(path: string, definition: PolicyDefinition | null): string {
  const parts = path.split(".");
  const out: string[] = [];
  let i = 0;
  if (parts[0] === "rules" && parts[1] !== undefined && /^\d+$/.test(parts[1])) {
    const r = Number(parts[1]);
    out.push(definition?.rules[r]?.label || `Rule ${r + 1}`);
    i = 2;
  } else if (parts[0] === "bypass" && parts[1] !== undefined && /^\d+$/.test(parts[1])) {
    const b = Number(parts[1]);
    out.push(definition?.bypass[b]?.label || `Automatic approval ${b + 1}`);
    i = 2;
  } else if (parts[0] === "fallback") {
    out.push("If nobody is found");
    i = 1;
  } else if (parts[0] === "independent") {
    out.push("Independent approver");
    i = 1;
  } else if (parts[0] === "rules") {
    return "Rules";
  }
  for (; i < parts.length; i++) {
    const p = parts[i];
    if (p === "stages" && /^\d+$/.test(parts[i + 1] ?? "")) {
      const r = Number(parts[1]);
      const s = Number(parts[i + 1]);
      out.push(definition?.rules[r]?.stages[s]?.name || `stage ${s + 1}`);
      i++;
    } else if (p === "when") out.push("applies when");
    else if (p === "resolver") out.push("who approves");
    else if (p === "fallback") out.push("if nobody is found");
    else if (p === "slaHours") out.push("time allowed");
    else if (p === "quorum") out.push("how many");
    else if (p === "label" || p === "name") out.push("name");
    else if (/^\d+$/.test(p) || p === "all" || p === "any" || p === "not") continue;
    else out.push(p.replace(/Id$/, ""));
  }
  return out.join(" › ") || path;
}

/* ------------------------------------------------------------------ */
/*  Simulator context                                                  */
/* ------------------------------------------------------------------ */

/** Drops blanks so the engine sees "not given" rather than "". */
export function cleanContext(values: Record<string, unknown>, flags: Record<string, boolean>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === "" || v == null || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = v;
  }
  const on = Object.fromEntries(Object.entries(flags).filter(([, v]) => v).map(([k, v]) => [k.slice(FLAG_PREFIX.length), v]));
  if (Object.keys(on).length > 0) out.flags = on;
  return out;
}
