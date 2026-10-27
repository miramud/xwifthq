"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgePercent, Check, CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import { FormField, INPUT_CLASS } from "@/components/pricing/FormField";
import { ListPicker } from "@/components/pricing/PricePickers";
import { percentText, publicAffiliates } from "@/lib/api/affiliate-client";
import { clearReferralCode, normaliseReferralCode, storeReferralCode, storedReferralCode } from "@/lib/referral";
import {
  MODULE_ORDER,
  ONBOARDING_STORAGE_KEY,
  PublicApiError,
  salesRequests,
  type ModuleKey,
  type OnboardingDetails,
  type PublicModule,
} from "@/lib/api/public-pricing";
import {
  CLOUD_MIN_EMPLOYEES,
  OWN_QUOTE_FROM,
  PRICE_LISTS,
  bandFor,
  careYearly,
  cloudRate,
  cloudYearly,
  formatPrice,
  listInfo,
  onboardingFor,
  ownLicence,
  type BandKey,
  type ModuleCount,
  type PriceList,
} from "@/lib/pricing/price-book";

type Step = 1 | 2 | 3;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Your plan" },
  { n: 2, label: "Your details" },
  { n: 3, label: "Review and send" },
];

export type Plan = "free" | "cloud" | "own";
const PLANS: { key: Plan; label: string; summary: string }[] = [
  { key: "free", label: "XwiftHQ Free", summary: "Up to 10 employees, for ever. HR, payroll and basic learning." },
  { key: "cloud", label: "XwiftHQ Cloud", summary: "Rent it: per employee a month, billed yearly. Hosting and updates included." },
  { key: "own", label: "XwiftHQ Own", summary: "Own it: a one-time licence sized to your company, with Care from year two." },
];
const PLAN_LABEL: Record<Plan, string> = { free: "XwiftHQ Free", cloud: "XwiftHQ Cloud", own: "XwiftHQ Own" };

/** What Free switches on: HR (records, leave, documents, payroll) and basic learning. */
const FREE_MODULES: readonly ModuleKey[] = ["lms", "hrm"];
const FREE_MAX_EMPLOYEES = 10;
const MAX_EMPLOYEES = 100_000;

/** A link from an Own band card lands on the smallest headcount in that band. */
const BAND_START: Record<BandKey, number> = { starter: CLOUD_MIN_EMPLOYEES, growth: 26, business: 101, enterprise: 301 };

const EMPTY: OnboardingDetails = {
  organisationName: "",
  name: "",
  email: "",
  phone: "",
  acceptTerms: false,
  website: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Every step opens on the same bold, tight title. */
const STEP_TITLE = "font-heading text-2xl font-bold tracking-[-0.02em] text-neutral-900";

/** A referral code the API has said is live, with what it is worth. */
interface Referral {
  code: string;
  firstName: string | null;
  discountPercent: number;
}

/** Stored between steps, never in the URL. */
interface Stored {
  details: OnboardingDetails;
  modules: ModuleKey[];
  plan?: Plan;
  list?: PriceList;
  employees?: number | null;
}

function readStoredRaw(): string | null {
  try {
    return window.sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** sessionStorage has no change event within a tab; the value is read once per render. */
const subscribeNever = () => () => {};

function writeStored(value: Stored) {
  try {
    window.sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* private mode: the flow still works within this page */
  }
}

function sortModules(keys: ModuleKey[]): ModuleKey[] {
  return [...keys].sort((a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b));
}

function parseModules(raw: string | null, available: PublicModule[]): ModuleKey[] {
  const known = new Set(available.map((m) => m.key));
  return sortModules((raw ?? "").split(",").filter((k): k is ModuleKey => known.has(k as ModuleKey)));
}

const isPlan = (v: unknown): v is Plan => v === "free" || v === "cloud" || v === "own";
const isList = (v: unknown): v is PriceList => PRICE_LISTS.some((l) => l.key === v);

function parseEmployees(raw: string | null): number | null {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_EMPLOYEES) : null;
}

const modulesText = (n: number) => `${n} ${n === 1 ? "module" : "modules"}`;

/**
 * The price of a choice, from the price book. `first` is the first invoice a
 * referral discount comes off; `note` is the price as the request states it.
 */
interface Quote {
  headline: string;
  caption: string;
  lines: string[];
  first: number | null;
  note: string;
}

function quoteFor(plan: Plan, list: PriceList, count: ModuleCount | null, employees: number | null): Quote | null {
  const price = (minor: number, cents = false) => formatPrice(minor, list, { cents });
  if (plan === "free") {
    return { headline: price(0), caption: "Free for up to 10 employees", lines: [], first: null, note: "Free" };
  }
  if (!count || !employees) return null;

  const onboarding = onboardingFor(employees);
  const onboardingPrice = onboarding.price[list];
  const onboardingLine = `${onboarding.label} onboarding: ${
    onboardingPrice === null ? "quoted" : `${onboarding.from ? "from " : ""}${price(onboardingPrice)}, one-time`
  }`;

  if (plan === "cloud") {
    const yearly = cloudYearly(list, count, employees);
    if (yearly === null) {
      return {
        headline: "Quoted",
        caption: "Over 500 employees, priced with you",
        lines: [onboardingLine],
        first: null,
        note: "Quoted (over 500 employees)",
      };
    }
    return {
      headline: price(yearly),
      caption: "A year, billed yearly",
      lines: [
        `${price(cloudRate(list, count), true)} per employee a month, less above 50`,
        ...(employees < CLOUD_MIN_EMPLOYEES ? [`Billed as ${CLOUD_MIN_EMPLOYEES} employees, the minimum`] : []),
        onboardingLine,
      ],
      first: yearly,
      note: `${price(yearly)} a year (${price(cloudRate(list, count), true)} per employee a month)`,
    };
  }

  const band = bandFor(employees);
  if (!band) {
    return {
      headline: "Quoted",
      caption: `Over 1,000 employees, from ${price(OWN_QUOTE_FROM[list])}`,
      lines: [onboardingLine],
      first: null,
      note: "Quoted (over 1,000 employees)",
    };
  }
  const licence = ownLicence(band, list, count);
  return {
    headline: price(licence),
    caption: `One-time, ${band.label} band (${band.range.toLowerCase()})`,
    lines: [`Care ${price(careYearly(licence))} a year from year two`, onboardingLine],
    first: licence,
    note: `${band.label} licence ${price(licence)} one-time, Care ${price(careYearly(licence))} a year from year two`,
  };
}

/**
 * Onboarding a new organisation on XwiftHQ: choose a plan (Free, Cloud or
 * Own) with headcount, price list and modules; say who you are; send the
 * request. The prices are the price book's, the same as the pricing page.
 *
 * Every plan ends in a licence request that the platform team confirms,
 * invoices and switches on by hand. Online checkout still charges the older
 * one-time ladder, which no longer matches any plan on sale, so the wizard
 * does not send anybody to it, whatever the owner's payment switch says.
 *
 * The choices live in the URL, so back and forward work and a link from a
 * pricing card lands on the right selection. Personal details live in
 * sessionStorage only: an email address and phone number do not belong in a
 * URL that ends up in history.
 *
 * Whoever completes this becomes the organisation's admin (the owner's rule),
 * which the details step says in so many words.
 */
export function OnboardingWizard({ modules: available }: { modules: PublicModule[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const uid = useId();

  // What this tab saved earlier. Read as an external store so the server
  // render and the first client render agree, and nothing has to be copied
  // into state in an effect.
  const storedRaw = useSyncExternalStore(subscribeNever, readStoredRaw, () => null);
  const stored = useMemo<Stored | null>(() => {
    try {
      return storedRaw ? (JSON.parse(storedRaw) as Stored) : null;
    } catch {
      return null;
    }
  }, [storedRaw]);

  const initial = useMemo(() => {
    const planParam = params.get("plan");
    const listParam = params.get("list");
    const bandParam = params.get("band") as BandKey | null;
    const listed = parseModules(params.get("modules"), available);
    const count = Number(params.get("count") ?? 0);
    return {
      plan: isPlan(planParam) ? planParam : isPlan(stored?.plan) ? stored.plan : "cloud",
      list: isList(listParam) ? listParam : isList(stored?.list) ? stored.list : "NG",
      employees:
        parseEmployees(params.get("employees")) ??
        (bandParam && bandParam in BAND_START ? BAND_START[bandParam] : null) ??
        stored?.employees ??
        null,
      modules:
        listed.length > 0
          ? listed
          : count >= 1 && count <= 5
            ? MODULE_ORDER.slice(0, count)
            : (stored?.modules ?? []),
    };
  }, [params, available, stored]);

  // `null` until the visitor touches it: until then the URL (or what was saved) decides.
  const [planState, setPlan] = useState<Plan | null>(null);
  const [listState, setList] = useState<PriceList | null>(null);
  const [employeesState, setEmployees] = useState<string | null>(null);
  const [modulesState, setModules] = useState<ModuleKey[] | null>(null);
  const plan = planState ?? initial.plan;
  const list = listState ?? initial.list;
  const employeesInput = employeesState ?? (initial.employees !== null ? String(initial.employees) : "");
  const employees = parseEmployees(employeesInput);
  const chosenModules = modulesState ?? initial.modules;
  const freeModules = useMemo(() => FREE_MODULES.filter((k) => available.some((m) => m.key === k)), [available]);
  const modules = plan === "free" ? freeModules : chosenModules;

  const [stepState, setStep] = useState<Step>(() => {
    const s = Number(params.get("step"));
    return s === 2 || s === 3 ? (s as Step) : 1;
  });
  const freeTooBig = plan === "free" && employees !== null && employees > FREE_MAX_EMPLOYEES;
  const planReady = modules.length > 0 && employees !== null && !freeTooBig;
  // A step past the first needs what came before it.
  const step: Step = planReady ? stepState : 1;

  const [detailsState, setDetails] = useState<OnboardingDetails | null>(null);
  const details = detailsState ?? (stored ? { ...EMPTY, ...stored.details, website: "" } : EMPTY);

  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingDetails, string>>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  /** Set once the request is in; the wizard then shows what happens next. Kept whole: the saved details are cleared. */
  const [sent, setSent] = useState<{ reference: string; email: string; name: string } | null>(null);

  // Keep the URL in step with the choices that are safe to put in it.
  useEffect(() => {
    const q = new URLSearchParams();
    if (step !== 1) q.set("step", String(step));
    q.set("plan", plan);
    q.set("list", list);
    if (employees !== null) q.set("employees", String(employees));
    if (plan !== "free" && chosenModules.length > 0) q.set("modules", chosenModules.join(","));
    router.replace(`/get-started?${q.toString()}`, { scroll: false });
  }, [step, plan, list, employees, chosenModules, router]);

  /*
    The affiliate who sent them, if any. The code comes from the cookie an
    affiliate link set (or from the box below), never from the URL, and only
    counts once the API says it is live. The request carries the code, so the
    platform records the referral when it sets the organisation up.
  */
  const [referral, setReferral] = useState<Referral | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  useEffect(() => {
    const code = storedReferralCode();
    if (!code) return;
    let alive = true;
    publicAffiliates
      .code(code)
      .then((check) => {
        if (alive && check.valid && check.code) {
          setReferral({ code: check.code, firstName: check.firstName, discountPercent: check.discountPercent });
        }
      })
      .catch(() => {
        // Without the check the order is simply priced in full.
      });
    return () => {
      alive = false;
    };
  }, []);

  async function applyCode(e: React.FormEvent) {
    e.preventDefault();
    const code = normaliseReferralCode(codeInput);
    if (!code) {
      setCodeError("Enter the code as it was given to you: letters and numbers only.");
      return;
    }
    setCheckingCode(true);
    setCodeError(null);
    try {
      const check = await publicAffiliates.code(code);
      if (check.valid && check.code) {
        setReferral({ code: check.code, firstName: check.firstName, discountPercent: check.discountPercent });
        // Kept like a followed link, so it survives a return visit.
        storeReferralCode(check.code, check.cookieDays);
        setCodeInput("");
        setCodeOpen(false);
      } else {
        setCodeError("That code isn't active. Check it with the person who gave it to you.");
      }
    } catch {
      setCodeError("We couldn't check that code just now. Try again in a moment.");
    } finally {
      setCheckingCode(false);
    }
  }

  function removeReferral() {
    setReferral(null);
    clearReferralCode();
  }

  const count = modules.length >= 1 && modules.length <= 5 ? (modules.length as ModuleCount) : null;
  const quote = quoteFor(plan, list, count, employees);
  const referralDiscount =
    referral && quote?.first ? Math.round((quote.first * referral.discountPercent) / 100) : 0;
  const moduleInfo = (key: ModuleKey) => available.find((m) => m.key === key);
  const info = listInfo(list);

  /** The line at the top of the request, so the team quotes what the visitor saw. */
  const planLine = `Plan: ${[
    PLAN_LABEL[plan],
    employees !== null ? `${employees} employees` : null,
    plan === "free" ? null : modulesText(modules.length),
    `${info.label} price list`,
    quote && plan !== "free" ? quote.note : null,
  ]
    .filter(Boolean)
    .join(", ")}.`;

  const toggle = (key: ModuleKey) =>
    setModules(chosenModules.includes(key) ? chosenModules.filter((k) => k !== key) : sortModules([...chosenModules, key]));

  const set = (key: keyof OnboardingDetails) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDetails({ ...details, [key]: e.target.value });
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  function save() {
    writeStored({ details: { ...details, website: "" }, modules: chosenModules, plan, list, employees });
  }

  function validateDetails(): boolean {
    const next: typeof errors = {};
    if (!details.organisationName.trim()) next.organisationName = "Enter your organisation's name.";
    if (!details.name.trim()) next.name = "Enter your full name.";
    if (!details.email.trim()) next.email = "Enter your work email.";
    else if (!EMAIL.test(details.email.trim())) next.email = "Enter a valid email address, like you@company.com.";
    const digits = details.phone.replace(/\D/g, "");
    if (!details.phone.trim()) next.phone = "Enter a phone number.";
    else if (digits.length < 7) next.phone = "Enter a full phone number, including the country code.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goTo(next: Step) {
    if (next === 3 && !validateDetails()) return;
    if (next >= 2) save();
    setSendError(null);
    setStep(next);
  }

  async function sendRequest() {
    if (!validateDetails()) {
      setStep(2);
      return;
    }
    setSending(true);
    setSendError(null);
    setExistingAccount(false);
    save();
    try {
      const result = await salesRequests.create({
        type: "licence",
        organisationName: details.organisationName.trim(),
        name: details.name.trim(),
        email: details.email.trim(),
        phone: details.phone.trim(),
        message: [planLine, message.trim()].filter(Boolean).join("\n\n"),
        modules,
        currency: info.currency,
        referralCode: referral?.code,
        website: details.website,
      });
      try {
        window.sessionStorage.removeItem(ONBOARDING_STORAGE_KEY);
      } catch {
        /* nothing saved to clear */
      }
      setSent({ reference: result.reference ?? result.id, email: details.email.trim(), name: details.name.trim() });
    } catch (error) {
      if (error instanceof PublicApiError && Object.keys(error.errors).length > 0) {
        const fieldErrors: typeof errors = {};
        for (const key of ["organisationName", "name", "email", "phone"] as const) {
          if (error.errors[key]?.[0]) fieldErrors[key] = error.errors[key][0];
        }
        setErrors(fieldErrors);
        setExistingAccount(Boolean(error.errors.email?.[0]?.toLowerCase().includes("already")));
        if (Object.keys(fieldErrors).length > 0) {
          setStep(2);
          return;
        }
        setSendError(error.errors.modules?.[0] ?? error.errors.message?.[0] ?? error.errors.currency?.[0] ?? error.message);
        return;
      }
      setSendError(
        error instanceof PublicApiError ? error.message : "We couldn't send your request. Check your connection and try again.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* ---------- progress ---------- */}
      <nav aria-label="Onboarding progress" className="xw-frame mx-auto max-w-3xl rounded-full! px-3 py-2.5 sm:px-5">
        <ol className="flex items-center gap-2 sm:gap-4">
          {STEPS.map((s, i) => {
            const done = step > s.n || sent !== null;
            const current = step === s.n && sent === null;
            return (
              <li key={s.n} className="flex flex-1 items-center gap-2 sm:gap-3" aria-current={current ? "step" : undefined}>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    done
                      ? "bg-primary-600 text-white shadow-[0_6px_16px_-8px_rgb(150_56_205/0.8)]"
                      : current
                        ? "bg-primary-50 text-primary-700 ring-2 ring-primary-600"
                        : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {done ? <Check size={16} aria-hidden="true" /> : s.n}
                </span>
                <span className={`hidden whitespace-nowrap text-sm font-semibold sm:inline ${current ? "text-neutral-900" : "text-neutral-500"}`}>
                  <span className="sr-only">Step {s.n} of 3: </span>
                  {s.label}
                </span>
                <span className="sr-only sm:hidden">
                  Step {s.n} of 3: {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <span className={`h-0.5 flex-1 rounded-full ${done ? "bg-primary-300" : "bg-neutral-200"}`} aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:gap-8">
        {/* ---------- the step ---------- */}
        <div className="min-w-0 lg:col-span-2">
          {sent !== null && (
            <RequestSent
              reference={sent.reference}
              email={sent.email}
              firstName={sent.name.split(/\s+/)[0]}
              free={plan === "free"}
            />
          )}

          {sent === null && step === 1 && (
            <section aria-labelledby={`${uid}-s1`} className="xw-frame p-5 sm:p-8">
              <h2 id={`${uid}-s1`} className={STEP_TITLE}>
                Choose your plan
              </h2>
              <p className="mt-2 text-neutral-600">
                Rent XwiftHQ, own it, or start free. Nothing is charged here: our team confirms your plan and sends the
                invoice.{" "}
                <Link href="/pricing" className="rounded font-semibold text-primary-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                  Compare plans
                </Link>
              </p>

              <fieldset className="mt-6">
                <legend className="sr-only">Plan</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {PLANS.map((p) => {
                    const checked = plan === p.key;
                    return (
                      <label
                        key={p.key}
                        className={`relative flex cursor-pointer flex-col rounded-[1.25rem] border p-4 transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${
                          checked
                            ? "border-primary-400 bg-primary-50/60 ring-1 ring-primary-400"
                            : "border-neutral-200 bg-neutral-50 hover:border-primary-200 hover:bg-white"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="font-heading text-base font-semibold text-neutral-900">{p.label}</span>
                          <input
                            type="radio"
                            name={`${uid}-plan`}
                            checked={checked}
                            onChange={() => setPlan(p.key)}
                            className="mt-1 h-5 w-5 shrink-0 accent-primary-600"
                          />
                        </span>
                        <span className="mt-2 text-sm leading-relaxed text-neutral-600">{p.summary}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-6 flex flex-col items-start gap-5">
                <FormField
                  id={`${uid}-employees`}
                  label="Employees"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  hint={
                    plan === "free"
                      ? "Free covers up to 10."
                      : plan === "own"
                        ? "Your headcount sets your licence band."
                        : "Everyone with an active staff record."
                  }
                  value={employeesInput}
                  onChange={(e) => setEmployees(e.target.value)}
                  error={
                    freeTooBig
                      ? "Free covers up to 10 employees. Choose Cloud or Own for a bigger team."
                      : undefined
                  }
                />
                <ListPicker value={list} onChange={setList} />
              </div>

              {plan === "free" ? (
                <p className="mt-6 rounded-[1.25rem] bg-neutral-50 p-5 text-sm leading-relaxed text-neutral-600">
                  Free switches on <span className="font-semibold text-neutral-800">HR</span> (records, leave, documents
                  and payroll) and <span className="font-semibold text-neutral-800">basic Learning</span> (up to three
                  courses). The other modules show in preview, and your 11th employee is when you move to a paid plan.
                </p>
              ) : (
                <fieldset className="mt-6">
                  <legend className="mb-3 text-sm font-semibold text-neutral-800">
                    Modules{" "}
                    <span className="font-normal text-neutral-500">
                      · the price depends on how many you take, not which
                    </span>
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {available.map((m) => {
                      const checked = chosenModules.includes(m.key);
                      return (
                        <label
                          key={m.key}
                          className={`relative flex cursor-pointer flex-col rounded-[1.25rem] border p-5 transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${
                            checked
                              ? "border-primary-400 bg-primary-50/60 ring-1 ring-primary-400"
                              : "border-neutral-200 bg-neutral-50 hover:border-primary-200 hover:bg-white"
                          }`}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="font-heading text-lg font-semibold text-neutral-900">{m.label}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(m.key)}
                              className="mt-1 h-5 w-5 shrink-0 accent-primary-600"
                            />
                          </span>
                          <span className="mt-2 text-sm leading-relaxed text-neutral-600">{m.summary}</span>
                          <span className={`label-mono mt-3 ${m.status === "available" ? "text-primary-700" : "text-neutral-500"}`}>
                            {m.status === "available" ? "Available now" : "Delivered when released"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  disabled={!planReady}
                  onClick={() => goTo(2)}
                  className="btn-primary min-h-11 gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </section>
          )}

          {sent === null && step === 2 && (
            <section aria-labelledby={`${uid}-s2`} className="xw-frame p-5 sm:p-8">
              <h2 id={`${uid}-s2`} className={STEP_TITLE}>
                Your organisation and your details
              </h2>
              <p className="mt-2 text-neutral-600">
                Whoever fills this in becomes the organisation&apos;s admin. You&apos;ll be first to sign in, then invite
                colleagues and hand out roles.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                Your organisation already uses XwiftHQ?{" "}
                <Link href="/login?redirect=/suite/org/billing" className="rounded font-semibold text-primary-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                  Sign in
                </Link>{" "}
                and request more modules from Plan &amp; billing.
              </p>

              <form
                className="mt-6 space-y-4"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  goTo(3);
                }}
              >
                <FormField
                  id={`${uid}-org`}
                  label="Organisation name"
                  autoComplete="organization"
                  value={details.organisationName}
                  onChange={set("organisationName")}
                  error={errors.organisationName}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id={`${uid}-name`}
                    label="Full name"
                    autoComplete="name"
                    value={details.name}
                    onChange={set("name")}
                    error={errors.name}
                  />
                  <FormField
                    id={`${uid}-phone`}
                    label="Phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+234 803 000 0000"
                    hint="Include the country code."
                    value={details.phone}
                    onChange={set("phone")}
                    error={errors.phone}
                  />
                </div>
                <FormField
                  id={`${uid}-email`}
                  label="Work email"
                  type="email"
                  autoComplete="email"
                  hint="Your confirmation, invoice and sign-in details go here."
                  value={details.email}
                  onChange={set("email")}
                  error={errors.email}
                />
                {existingAccount && (
                  <p className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
                    Already using XwiftHQ?{" "}
                    <Link
                      href={`/login?email=${encodeURIComponent(details.email)}&redirect=/suite/org/billing`}
                      className="rounded font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      Sign in
                    </Link>{" "}
                    and request modules from Plan &amp; billing.
                  </p>
                )}

                {/* Honeypot: invisible to people, irresistible to bots. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor={`${uid}-website`}>Website</label>
                  <input
                    id={`${uid}-website`}
                    tabIndex={-1}
                    autoComplete="off"
                    value={details.website}
                    onChange={set("website")}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                  <button type="button" onClick={() => goTo(1)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back
                  </button>
                  <button type="submit" className="btn-primary min-h-11 gap-2">
                    Review your request
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </form>
            </section>
          )}

          {sent === null && step === 3 && (
            <section aria-labelledby={`${uid}-s3`} className="xw-frame p-5 sm:p-8">
              <h2 id={`${uid}-s3`} className={STEP_TITLE}>
                Review and send
              </h2>
              <p className="mt-2 text-neutral-600">
                {plan === "free"
                  ? "Give everything a quick check. Our team sets up your free workspace and emails you a log in."
                  : "Give everything a quick check. Nothing is charged today: our team confirms your plan with you, sends the invoice, then switches your modules on."}
              </p>

              <dl className="mt-6 divide-y divide-neutral-200/70 rounded-[1.25rem] bg-neutral-50">
                {[
                  ["Plan", PLAN_LABEL[plan]],
                  ["Organisation", details.organisationName],
                  ["Admin", details.name],
                  ["Email", details.email],
                  ["Phone", details.phone],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap justify-between gap-2 px-5 py-4 text-sm">
                    <dt className="text-neutral-500">{label}</dt>
                    <dd className="min-w-0 break-words font-medium text-neutral-900">{value || "-"}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6">
                <FormField id={`${uid}-message`} label="Anything we should know?" optional>
                  <textarea
                    id={`${uid}-message`}
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Timelines, the systems you use today, questions about payment…"
                    className={`${INPUT_CLASS} resize-y`}
                  />
                </FormField>
              </div>

              {sendError && (
                <p role="alert" className="mt-4 rounded-xl border border-error-500/20 bg-error-500/10 px-4 py-3 text-sm text-error-700">
                  {sendError}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => goTo(2)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back
                </button>
                <button type="button" onClick={sendRequest} disabled={sending} className="btn-primary min-h-11 gap-2 disabled:opacity-70">
                  {sending ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                  {sending ? "Sending request…" : "Send request"}
                </button>
              </div>
            </section>
          )}
        </div>

        {/* ---------- order summary ---------- */}
        <aside aria-label="Order summary" className="xw-glow-card h-fit p-6 lg:sticky lg:top-28">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Your request</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {PLAN_LABEL[plan]} · {info.label} price list
          </p>
          {referral && (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-primary-50 py-1 pl-4 pr-1 text-sm text-primary-800 ring-1 ring-inset ring-primary-100">
              <p className="flex items-start gap-2 py-2">
                <BadgePercent size={16} className="mt-0.5 shrink-0 text-primary-600" aria-hidden="true" />
                <span>
                  {referral.firstName ? `Referred by ${referral.firstName}` : `Referral code ${referral.code}`}:{" "}
                  {percentText(referral.discountPercent)} off your first payment
                </span>
              </p>
              <button
                type="button"
                onClick={removeReferral}
                className="min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold text-primary-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Remove<span className="sr-only"> referral code</span>
              </button>
            </div>
          )}
          {modules.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Pick at least one module and your price shows up here.</p>
          ) : (
            <>
              <ul className="mt-4 space-y-2 text-sm">
                {modules.map((key) => {
                  const m = moduleInfo(key);
                  return (
                    <li key={key} className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-2 text-neutral-800">
                        <Check size={14} className="text-primary-600" aria-hidden="true" />
                        {plan === "free" && key === "lms" ? "Learning (basic)" : (m?.label ?? key)}
                      </span>
                      {m?.status === "coming_soon" && <span className="text-xs text-neutral-500">When released</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 border-t border-neutral-200/70 pt-4" aria-live="polite">
                {quote === null ? (
                  <p className="text-sm text-neutral-500">Enter your headcount and your price shows up here.</p>
                ) : (
                  <>
                    {referralDiscount > 0 && quote.first !== null && (
                      <dl className="mb-3 space-y-1.5 text-sm">
                        <div className="flex flex-wrap justify-between gap-x-3">
                          <dt className="text-neutral-600">List price</dt>
                          <dd className="tabular-nums text-neutral-800">{formatPrice(quote.first, list)}</dd>
                        </div>
                        <div className="flex flex-wrap justify-between gap-x-3">
                          <dt className="text-neutral-600">Referral discount ({percentText(referral!.discountPercent)})</dt>
                          <dd className="font-medium tabular-nums text-mint-700">-{formatPrice(referralDiscount, list)}</dd>
                        </div>
                      </dl>
                    )}
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm text-neutral-600">
                        {plan === "free" ? "Free" : `${employees} employees · ${modulesText(modules.length)}`}
                      </span>
                      <span className="font-heading text-2xl font-bold tracking-[-0.02em] tabular-nums text-neutral-900">
                        {quote.first !== null ? formatPrice(quote.first - referralDiscount, list) : quote.headline}
                      </span>
                    </p>
                    <p className="label-mono mt-1 text-right text-neutral-500">{quote.caption}</p>
                    {quote.lines.length > 0 && (
                      <ul className="mt-3 space-y-1 text-right text-xs leading-relaxed text-neutral-500">
                        {quote.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </>
          )}
          {!referral && sent === null && plan !== "free" && (
            <div className="mt-5 border-t border-neutral-200/70 pt-4">
              <button
                type="button"
                aria-expanded={codeOpen}
                aria-controls={`${uid}-code-panel`}
                onClick={() => setCodeOpen((o) => !o)}
                className="inline-flex min-h-11 items-center rounded-full text-sm font-semibold text-primary-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Have a referral code?
              </button>
              <form id={`${uid}-code-panel`} hidden={!codeOpen} onSubmit={applyCode} noValidate className="mt-2">
                <label htmlFor={`${uid}-code`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Referral code
                </label>
                <div className="flex gap-2">
                  <input
                    id={`${uid}-code`}
                    value={codeInput}
                    onChange={(e) => {
                      setCodeInput(e.target.value);
                      setCodeError(null);
                    }}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    aria-invalid={codeError ? true : undefined}
                    aria-describedby={codeError ? `${uid}-code-error` : undefined}
                    className={`${INPUT_CLASS} min-w-0 flex-1 uppercase`}
                  />
                  <button
                    type="submit"
                    disabled={checkingCode || codeInput.trim() === ""}
                    className="btn-outline min-h-11 shrink-0 px-4 disabled:opacity-60"
                  >
                    {checkingCode ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                    Apply
                  </button>
                </div>
                {codeError && (
                  <p id={`${uid}-code-error`} role="alert" className="mt-1.5 text-xs font-medium text-error-700">
                    {codeError}
                  </p>
                )}
              </form>
            </div>
          )}
          <p className="mt-5 flex items-start gap-2 text-xs text-neutral-500">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary-600" aria-hidden="true" />
            <span>
              Nothing is charged online. Prices exclude VAT (7.5% in Nigeria), and our team invoices once your plan is
              confirmed.
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}

/** The wizard's last state: the request is in, and here is what follows. */
function RequestSent({
  reference,
  email,
  firstName,
  free,
}: {
  reference: string;
  email: string;
  firstName?: string;
  free: boolean;
}) {
  const uid = useId();
  // A real sequence, so the numbers carry order. The first has already happened.
  const nextSteps = [
    { title: "Confirmation email", body: "A copy of your request, with its reference, is on its way to your inbox." },
    {
      title: "We confirm the details",
      body: free
        ? "Someone from our team checks your company details and sets up your free workspace."
        : "Someone from our team gets in touch to confirm your plan and modules, and sends the invoice.",
    },
    { title: "Your workspace goes live", body: "We switch everything on and you sign in to XwiftHQ as your organisation's admin." },
  ];

  return (
    <section role="status" aria-labelledby={`${uid}-title`} className="xw-frame p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <CheckCircle2 className="h-11 w-11 text-primary-600" aria-hidden="true" />
        <p className="rounded-xl bg-primary-50 px-3 py-2 text-right">
          <span className="label-mono block text-neutral-500">Reference</span>
          <span className="font-mono text-base font-semibold tracking-wide text-neutral-900">{reference}</span>
        </p>
      </div>
      <h2 id={`${uid}-title`} className={`${STEP_TITLE} mt-5`}>
        Request sent{firstName ? `, ${firstName}` : ""}
      </h2>
      <p className="mt-2 leading-relaxed text-neutral-600">
        A confirmation email is on its way to <span className="font-medium text-neutral-800">{email}</span>. Quote the
        reference whenever you get in touch.
      </p>

      <h3 className="label-mono mt-8 text-neutral-500">What happens next</h3>
      <ol className="mt-4 space-y-5">
        {nextSteps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                i === 0 ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-600"
              }`}
              aria-hidden="true"
            >
              {i === 0 ? <Check size={15} /> : i + 1}
            </span>
            <span>
              <span className="block font-semibold text-neutral-900">{s.title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-neutral-600">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-neutral-200/70 pt-6">
        <Link href="/" className="btn-primary min-h-11">
          Back to the homepage
        </Link>
        <Link href="/pricing" className="btn-outline min-h-11">
          See pricing
        </Link>
      </div>
    </section>
  );
}
