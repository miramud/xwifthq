/**
 * The XwiftHQ price book: "Rent or Own".
 *
 * Source: the Pricing & Go-To-Market Strategy (docs/pricing-strategy, 23 Oct
 * 2026) and its model (`model.js`). Every figure on the pricing page is
 * computed here from the same few constants and rounding rules as the model,
 * so the cards, the band table and the calculator cannot disagree with the
 * paper or with each other.
 *
 * - XwiftHQ Cloud: per employee per month, billed yearly, graduated volume
 *   pricing above 50 employees, minimum 10 employees.
 * - XwiftHQ Own: a one-time licence by company size, year one of Care
 *   included, Care at 20% of the licence a year from year two.
 * - Both: 1–5 modules at fixed shares of the full-suite price.
 *
 * The platform API still serves the older one-time ladder (`/public/pricing`),
 * so this module is the page's source of truth until the API carries the new
 * book. Money is integer minor units (kobo, cents), as everywhere else.
 */

import type { Currency } from "@/lib/api/public-pricing";

/* ------------------------------------------------------------------ */
/*  Price lists                                                        */
/* ------------------------------------------------------------------ */

export type PriceList = "NG" | "AFR" | "INT";

export interface PriceListInfo {
  key: PriceList;
  label: string;
  currency: Currency;
  /** Who the list is for, in a line. */
  note: string;
}

export const PRICE_LISTS: readonly PriceListInfo[] = [
  { key: "NG", label: "Nigeria", currency: "NGN", note: "Nigerian companies, invoiced in naira." },
  {
    key: "AFR",
    label: "Africa",
    currency: "USD",
    note: "Companies elsewhere in Africa, and Nigerian companies that pay in dollars.",
  },
  { key: "INT", label: "International", currency: "USD", note: "Companies outside Africa." },
];

export const listInfo = (list: PriceList): PriceListInfo => PRICE_LISTS.find((l) => l.key === list)!;

/* ------------------------------------------------------------------ */
/*  Modules                                                            */
/* ------------------------------------------------------------------ */

export type ModuleCount = 1 | 2 | 3 | 4 | 5;
export const MODULE_COUNTS: readonly ModuleCount[] = [1, 2, 3, 4, 5];

/** Share of the full-suite price paid for 1..5 modules, the same rule for Cloud and Own. */
export const MODULE_SHARE: Record<ModuleCount, number> = { 1: 35, 2: 60, 3: 78, 4: 90, 5: 100 };

/** Round a share of `suite` to `step`, in integers so 7.65 does not become 7.6. */
function share(suite: number, modules: ModuleCount, step: number): number {
  return Math.round((suite * MODULE_SHARE[modules]) / (100 * step)) * step;
}

/* ------------------------------------------------------------------ */
/*  XwiftHQ Cloud                                                      */
/* ------------------------------------------------------------------ */

/** Full suite, per employee per month, billed yearly: ₦9,500 / $8.50 / $16. */
const CLOUD_SUITE: Record<PriceList, number> = { NG: 950_000, AFR: 850, INT: 1_600 };
/** Rates round to ₦100 or 10 cents. */
const CLOUD_STEP: Record<PriceList, number> = { NG: 10_000, AFR: 10, INT: 10 };

/** Graduated: each employee is priced in the band it falls in, like income tax. Above 500 is quoted. */
export const CLOUD_VOLUME = [
  { from: 1, to: 50, percent: 100 },
  { from: 51, to: 200, percent: 70 },
  { from: 201, to: 500, percent: 50 },
] as const;
export const CLOUD_MAX_LISTED = 500;
export const CLOUD_MIN_EMPLOYEES = 10;

/** Billing more often than yearly costs more: quarterly +10%, monthly +20%. */
export const BILLING_UPLIFT = { yearly: 0, quarterly: 10, monthly: 20 } as const;

/** The list rate per employee per month for the first 50 employees. */
export function cloudRate(list: PriceList, modules: ModuleCount): number {
  return share(CLOUD_SUITE[list], modules, CLOUD_STEP[list]);
}

/** The rate an employee in a volume band pays. */
export function cloudBandRate(list: PriceList, modules: ModuleCount, percent: number): number {
  return Math.round((cloudRate(list, modules) * percent) / 100);
}

/**
 * The monthly Cloud bill on yearly billing, or `null` above 500 employees
 * (quoted). Fewer than 10 employees are billed as 10.
 */
export function cloudMonthly(list: PriceList, modules: ModuleCount, employees: number): number | null {
  if (employees > CLOUD_MAX_LISTED) return null;
  const billed = Math.max(Math.ceil(employees), CLOUD_MIN_EMPLOYEES);
  let total = 0;
  for (const band of CLOUD_VOLUME) {
    const inBand = Math.max(0, Math.min(billed, band.to) - band.from + 1);
    total += inBand * cloudBandRate(list, modules, band.percent);
  }
  return total;
}

export function cloudYearly(list: PriceList, modules: ModuleCount, employees: number): number | null {
  const monthly = cloudMonthly(list, modules, employees);
  return monthly === null ? null : monthly * 12;
}

/* ------------------------------------------------------------------ */
/*  XwiftHQ Own                                                        */
/* ------------------------------------------------------------------ */

export type BandKey = "starter" | "growth" | "business" | "enterprise";

export interface Band {
  key: BandKey;
  label: string;
  range: string;
  max: number;
  /** Full-suite licence, one-time. */
  suite: Record<PriceList, number>;
}

export const BANDS: readonly Band[] = [
  { key: "starter", label: "Starter", range: "Up to 25 employees", max: 25, suite: { NG: 450_000_000, AFR: 400_000, INT: 800_000 } },
  { key: "growth", label: "Growth", range: "26–100 employees", max: 100, suite: { NG: 1_250_000_000, AFR: 1_150_000, INT: 2_200_000 } },
  { key: "business", label: "Business", range: "101–300 employees", max: 300, suite: { NG: 3_500_000_000, AFR: 3_200_000, INT: 6_000_000 } },
  { key: "enterprise", label: "Enterprise", range: "301–1,000 employees", max: 1000, suite: { NG: 7_000_000_000, AFR: 6_400_000, INT: 12_000_000 } },
];

/** Above 1,000 employees Own is quoted, from ₦120m / US$120,000. */
export const OWN_QUOTE_FROM: Record<PriceList, number> = { NG: 12_000_000_000, AFR: 12_000_000, INT: 12_000_000 };

/** Licences round to ₦100,000 or $100. */
const OWN_STEP: Record<PriceList, number> = { NG: 10_000_000, AFR: 10_000, INT: 10_000 };

/** Care a year, from year two, as a percentage of the licence list price. */
export const CARE_PERCENT = 20;
export const CARE_PLUS_PERCENT = 28;

/** Rent-to-own: the licence in 12 monthly payments (+8%) or 24 (+15%). */
export const RENT_TO_OWN = [
  { payments: 12, uplift: 8 },
  { payments: 24, uplift: 15 },
] as const;

export const bandFor = (employees: number): Band | null => BANDS.find((b) => employees <= b.max) ?? null;

export function ownLicence(band: Band, list: PriceList, modules: ModuleCount): number {
  return share(band.suite[list], modules, OWN_STEP[list]);
}

export function careYearly(licence: number, percent: number = CARE_PERCENT): number {
  return Math.round((licence * percent) / 100);
}

export function rentToOwnPayment(licence: number, payments: number, uplift: number): number {
  return Math.round((licence * (100 + uplift)) / 100 / payments);
}

/* ------------------------------------------------------------------ */
/*  Onboarding and add-ons                                             */
/* ------------------------------------------------------------------ */

export interface OnboardingPackage {
  key: string;
  label: string;
  forWhom: string;
  max: number;
  /** `null`: quoted. */
  price: Record<PriceList, number | null>;
  /** True when the price is a starting point. */
  from?: boolean;
  includes: string;
}

export const ONBOARDING: readonly OnboardingPackage[] = [
  {
    key: "quick-start",
    label: "Quick Start",
    forWhom: "Up to 25 staff",
    max: 25,
    price: { NG: 50_000_000, AFR: 45_000, INT: 90_000 },
    includes: "Two remote sessions, staff import, payroll set-up and your first payroll run together.",
  },
  {
    key: "standard",
    label: "Standard",
    forWhom: "26–100 staff",
    max: 100,
    price: { NG: 150_000_000, AFR: 135_000, INT: 270_000 },
    includes: "Migration from Excel or one system, opening balances, approval policies and four training sessions.",
  },
  {
    key: "premium",
    label: "Premium",
    forWhom: "101–300 staff",
    max: 300,
    price: { NG: 400_000_000, AFR: 360_000, INT: 720_000 },
    includes: "Migration from up to three systems, on-site days, custom roles and workflows, and go-live support.",
  },
  {
    key: "enterprise",
    label: "Enterprise",
    forWhom: "300+ staff",
    max: Number.POSITIVE_INFINITY,
    price: { NG: 800_000_000, AFR: null, INT: null },
    from: true,
    includes: "A project-managed roll-out, integrations and train-the-trainer.",
  },
];

export const onboardingFor = (employees: number): OnboardingPackage =>
  ONBOARDING.find((p) => employees <= p.max) ?? ONBOARDING[ONBOARDING.length - 1];

/* ------------------------------------------------------------------ */
/*  Comparisons                                                        */
/* ------------------------------------------------------------------ */

/** What owning costs over `years`: the licence, then Care from year two. */
export function ownTotal(licence: number, years: number): number {
  return licence + careYearly(licence) * Math.max(0, years - 1);
}

/**
 * After how many years owning has cost no more than renting, as the paper
 * counts it (12.5m + 2.5m Care a year against 5.7m a year: about 3.1), or
 * `null` when renting stays cheaper for ten years.
 */
export function ownBreakEvenYears(licence: number, cloudPerYear: number): number | null {
  const care = careYearly(licence);
  if (cloudPerYear <= care) return null;
  const years = Math.max(1, (licence - care) / (cloudPerYear - care));
  return years <= 10 ? years : null;
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

/**
 * ₦9,500 / $8.50 / ₦12,500,000. Dollar amounts keep their cents when they
 * have any (or when `cents` asks for them, as a per-employee rate does).
 */
export function formatPrice(minor: number, list: PriceList, { cents = false }: { cents?: boolean } = {}): string {
  const currency = listInfo(list).currency;
  const digits = currency === "USD" && (cents || minor % 100 !== 0) ? 2 : 0;
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 100);
}
