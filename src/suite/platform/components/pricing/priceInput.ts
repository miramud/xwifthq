import {
  LADDER_RUNGS,
  SELLING_CURRENCIES,
  type PlatformPricing,
  type SellingCurrency,
} from "@/lib/api/platform-billing-client";
import { majorText, parseMajor } from "@/lib/money";

/*
  Price entry for the ladder editor. People type major units (naira, dollars);
  the API speaks minor units. Every rung must have a price — the ladder has no
  gaps, because an organisation owning three modules has to have a price to
  pay for a fourth — and each rung must cost at least as much as the one below
  it: owning more can never be cheaper than owning less, or buying one module
  at a time would beat buying them together.
*/

type Rung = (typeof LADDER_RUNGS)[number];

/** What the boxes hold while somebody edits. */
export interface PricingDrafts {
  ladder: Record<SellingCurrency, Record<Rung, string>>;
  sourceCode: Record<SellingCurrency, string>;
}

export function toDrafts(pricing: PlatformPricing): PricingDrafts {
  const ladder = {} as PricingDrafts["ladder"];
  const sourceCode = {} as PricingDrafts["sourceCode"];
  for (const c of SELLING_CURRENCIES) {
    ladder[c] = {} as Record<Rung, string>;
    for (const n of LADDER_RUNGS) ladder[c][n] = majorText(pricing.ladder?.[c]?.[String(n)] ?? null);
    sourceCode[c] = majorText(pricing.sourceCode?.[c] ?? null);
  }
  return { ladder, sourceCode };
}

export function sameDrafts(a: PricingDrafts, b: PricingDrafts): boolean {
  return SELLING_CURRENCIES.every(
    (c) =>
      a.sourceCode[c].trim() === b.sourceCode[c].trim() &&
      LADDER_RUNGS.every((n) => a.ladder[c][n].trim() === b.ladder[c][n].trim()),
  );
}

/** A problem with one box, addressed by where it sits. */
export interface PricingProblem {
  currency: SellingCurrency;
  /** A ladder rung, or "source" for the source-code price. */
  field: Rung | "source";
  message: string;
}

/** Parsed prices ready for the API, or every box that's wrong and why. */
export function parseDrafts(drafts: PricingDrafts): { pricing: PlatformPricing } | { problems: PricingProblem[] } {
  const problems: PricingProblem[] = [];
  const pricing = { ladder: {}, sourceCode: {} } as PlatformPricing;

  for (const c of SELLING_CURRENCIES) {
    const rungs: Record<string, number> = {};
    let previous: number | null = null;

    for (const n of LADDER_RUNGS) {
      const v = parseMajor(drafts.ladder[c][n]);
      if (v === "invalid") {
        problems.push({ currency: c, field: n, message: "Enter an amount, like 2500000." });
      } else if (v === null || v === 0) {
        problems.push({ currency: c, field: n, message: "Every step needs a price." });
      } else {
        if (previous !== null && v < previous) {
          problems.push({
            currency: c,
            field: n,
            message: `${n} modules can't cost less than ${n - 1}.`,
          });
        }
        rungs[String(n)] = v;
        previous = v;
      }
    }
    pricing.ladder[c] = rungs;

    const source = parseMajor(drafts.sourceCode[c]);
    if (source === "invalid") problems.push({ currency: c, field: "source", message: "Enter an amount." });
    else if (source === null || source === 0) problems.push({ currency: c, field: "source", message: "Set a price." });
    else pricing.sourceCode[c] = source;
  }

  return problems.length ? { problems } : { pricing };
}

/** What one module works out at on a rung — the "per module" hint beside each box. */
export function perModule(totalMinor: number | "invalid" | null, rung: number): number | null {
  if (typeof totalMinor !== "number" || rung < 1) return null;
  return Math.round(totalMinor / rung);
}
