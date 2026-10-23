import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import type { LineKind, PrFull, PrInput } from "@/lib/api/operations-procurement-client";
import { lineTotal, parseQty } from "@/suite/operations/components/procurement/meta";

/*
  The purchase request form as typed, and the request as the API takes it.
  Amounts are typed in naira and kept as text until sent; the estimate is
  worked out from the text as it changes, in kobo, the way the API does.
*/

/** Where receiving puts a goods line: nowhere in particular, the asset register, or a store. */
export type PutAway = "none" | "asset" | "stock";

export interface LineForm {
  key: string;
  kind: LineKind;
  description: string;
  quantity: string;
  unit: string;
  price: string;
  putAway: PutAway;
  assetCategoryId: string;
  itemId: string;
}

export interface PrForm {
  title: string;
  category: string;
  funding: "project" | "costCentre";
  projectId: string;
  costCentreId: string;
  neededBy: string;
  location: string;
  justification: string;
  singleSource: boolean;
  singleSourceReason: string;
  lines: LineForm[];
}

let seq = 0;
export const newLine = (kind: LineKind = "goods"): LineForm => ({
  key: `l${++seq}`,
  kind,
  description: "",
  quantity: "1",
  unit: kind === "service" ? "job" : "each",
  price: "",
  putAway: "none",
  assetCategoryId: "",
  itemId: "",
});

export const BLANK: PrForm = {
  title: "",
  category: "",
  funding: "project",
  projectId: "",
  costCentreId: "",
  neededBy: "",
  location: "",
  justification: "",
  singleSource: false,
  singleSourceReason: "",
  lines: [],
};

export function fromRequest(pr: PrFull): PrForm {
  return {
    title: pr.title,
    category: pr.category,
    funding: pr.project || !pr.costCentreId ? "project" : "costCentre",
    projectId: pr.project?.id ?? "",
    costCentreId: pr.costCentreId ?? "",
    neededBy: pr.neededBy ?? "",
    location: pr.location ?? "",
    justification: pr.justification ?? "",
    singleSource: Boolean(pr.singleSourceReason),
    singleSourceReason: pr.singleSourceReason ?? "",
    lines: pr.lines.map((l) => ({
      ...newLine(l.kind),
      description: l.description,
      quantity: String(l.quantity),
      unit: l.unit,
      price: amountInput(l.estUnitPrice),
      putAway: l.assetCategoryId ? "asset" : l.itemId ? "stock" : "none",
      assetCategoryId: l.assetCategoryId ?? "",
      itemId: l.itemId ?? "",
    })),
  };
}

/** A line's estimate in kobo, from what is typed (0 until both are numbers). */
export function lineEstimate(l: Pick<LineForm, "quantity" | "price">): number {
  const q = parseQty(l.quantity);
  const p = parseAmount(l.price);
  return q === null || p === null ? 0 : lineTotal(q, p);
}

/** The estimate, and how much of it is goods and services. */
export function estimate(lines: LineForm[]): { total: number; goods: number; services: number } {
  let goods = 0;
  let services = 0;
  for (const l of lines) {
    const v = lineEstimate(l);
    if (l.kind === "service") services += v;
    else goods += v;
  }
  return { total: goods + services, goods, services };
}

export type FormErrors = Record<string, string>;

/** The request as the API takes it, or what is missing. Line errors are keyed `line.{key}`. */
export function toInput(f: PrForm): { input: PrInput | null; errors: FormErrors } {
  const errors: FormErrors = {};
  if (!f.title.trim()) errors.title = "Give the request a short title.";
  if (!f.category) errors.category = "Choose what kind of purchase it is.";
  if (f.funding === "project" ? !f.projectId : !f.costCentreId) errors.funding = f.funding === "project" ? "Choose the project that pays for it." : "Choose the cost centre that pays for it.";
  if (f.singleSource && !f.singleSourceReason.trim()) errors.singleSourceReason = "Say why only one vendor can supply it.";
  if (f.lines.length === 0) errors.lines = "Add at least one line: what you need, how many, and roughly what each costs.";
  for (const l of f.lines) {
    const q = parseQty(l.quantity);
    const p = parseAmount(l.price);
    if (!l.description.trim()) errors[`line.${l.key}`] = l.kind === "service" ? "Describe the service." : "Describe the item.";
    else if (q === null || q <= 0) errors[`line.${l.key}`] = "The quantity is a number above 0, like 4 or 2.5.";
    else if (!l.unit.trim()) errors[`line.${l.key}`] = "Give the unit, like each, box or job.";
    else if (p === null) errors[`line.${l.key}`] = "Type the estimated unit price, like 95,000.00.";
    else if (l.kind === "goods" && l.putAway === "asset" && !l.assetCategoryId) errors[`line.${l.key}`] = "Choose the asset category, or say it isn't tracked.";
    else if (l.kind === "goods" && l.putAway === "stock" && !l.itemId) errors[`line.${l.key}`] = "Choose the stock item, or say it isn't tracked.";
  }
  if (Object.keys(errors).length) return { input: null, errors };
  return {
    errors,
    input: {
      title: f.title.trim(),
      category: f.category,
      justification: f.justification.trim() || null,
      neededBy: f.neededBy || null,
      location: f.location.trim() || null,
      projectId: f.funding === "project" ? f.projectId : null,
      costCentreId: f.funding === "costCentre" ? f.costCentreId : null,
      singleSourceReason: f.singleSource ? f.singleSourceReason.trim() : null,
      lines: f.lines.map((l) => ({
        kind: l.kind,
        description: l.description.trim(),
        quantity: parseQty(l.quantity) as number,
        unit: l.unit.trim(),
        estUnitPrice: parseAmount(l.price) as number,
        // Only goods are put away; the key is left out when there is nothing to say.
        ...(l.kind === "goods" && l.putAway === "asset" && l.assetCategoryId ? { assetCategoryId: l.assetCategoryId } : {}),
        ...(l.kind === "goods" && l.putAway === "stock" && l.itemId ? { itemId: l.itemId } : {}),
      })),
    },
  };
}
