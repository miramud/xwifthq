"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Lock, Send, ShieldCheck } from "lucide-react";
import { FormField, INPUT_CLASS } from "@/components/pricing/FormField";
import {
  CLAIM_STORAGE_KEY,
  MODULE_ORDER,
  ONBOARDING_STORAGE_KEY,
  PublicApiError,
  formatMoney,
  onboarding,
  salesRequests,
  tierFor,
  type Currency,
  type ModuleKey,
  type OnboardingDetails,
  type PublicPricing,
} from "@/lib/api/public-pricing";

type Step = 1 | 2 | 3;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Modules" },
  { n: 2, label: "Your details" },
  { n: 3, label: "Review and pay" },
];
/** While online payment is off the last step sends a licence request instead. */
const REQUEST_STEPS: { n: Step; label: string }[] = [...STEPS.slice(0, 2), { n: 3, label: "Review and send" }];

const EMPTY: OnboardingDetails = {
  organisationName: "",
  name: "",
  email: "",
  phone: "",
  acceptTerms: false,
  website: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stored between steps and across the trip to the gateway, never in the URL. */
interface Stored {
  details: OnboardingDetails;
  modules: ModuleKey[];
  currency: Currency;
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

function parseModules(raw: string | null, pricing: PublicPricing): ModuleKey[] {
  const known = new Set(pricing.modules.map((m) => m.key));
  return (raw ?? "")
    .split(",")
    .filter((k): k is ModuleKey => known.has(k as ModuleKey))
    .sort((a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b));
}

/**
 * Onboarding a new organisation: choose modules, say who you are, pay once —
 * or, while the owner has online payment switched off, send a licence request
 * that the platform team confirms, invoices and switches on by hand.
 *
 * The module choice, currency and step live in the URL, so back and forward
 * work and a link from a pricing card lands on the right selection. Personal
 * details live in sessionStorage only — an email address and phone number do
 * not belong in a URL that ends up in history and in the gateway's referrer.
 *
 * Whoever completes this becomes the organisation's admin (the owner's rule),
 * which the details step says in so many words.
 */
export function OnboardingWizard({ pricing }: { pricing: PublicPricing }) {
  const router = useRouter();
  const params = useSearchParams();
  const uid = useId();
  const requestMode = !pricing.paymentsEnabled;
  const steps = requestMode ? REQUEST_STEPS : STEPS;

  const initialCurrency = (params.get("currency") as Currency | null) ?? pricing.currencies[0] ?? "NGN";
  const initialModules = useMemo(() => {
    const listed = parseModules(params.get("modules"), pricing);
    if (listed.length > 0) return listed;
    const count = Number(params.get("count") ?? 0);
    return count >= 1 && count <= 5 ? MODULE_ORDER.slice(0, count) : [];
  }, [params, pricing]);

  const [stepState, setStep] = useState<Step>(() => {
    const s = Number(params.get("step"));
    return s === 2 || s === 3 ? (s as Step) : 1;
  });
  const [currency, setCurrency] = useState<Currency>(
    pricing.currencies.includes(initialCurrency) ? initialCurrency : (pricing.currencies[0] ?? "NGN"),
  );

  // What this tab saved earlier (details, and the choice before a failed
  // payment). Read as an external store so the server render and the first
  // client render agree, and nothing has to be copied into state in an effect.
  const storedRaw = useSyncExternalStore(subscribeNever, readStoredRaw, () => null);
  const stored = useMemo<Stored | null>(() => {
    try {
      return storedRaw ? (JSON.parse(storedRaw) as Stored) : null;
    } catch {
      return null;
    }
  }, [storedRaw]);

  // `null` until the visitor touches it: until then the URL (or what was saved) decides.
  const [modulesState, setModules] = useState<ModuleKey[] | null>(null);
  const modules = useMemo(
    () => modulesState ?? (initialModules.length > 0 ? initialModules : (stored?.modules ?? [])),
    [modulesState, initialModules, stored],
  );
  const [detailsState, setDetails] = useState<OnboardingDetails | null>(null);
  const details = detailsState ?? (stored ? { ...EMPTY, ...stored.details, website: "" } : EMPTY);

  // A step past the first needs what came before it.
  const step: Step = modules.length === 0 ? 1 : stepState;

  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingDetails, string>>>({});
  const [payError, setPayError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  /** Set once the request is in; the wizard then shows what happens next. Kept whole: the saved details are cleared. */
  const [sent, setSent] = useState<{ reference: string; email: string; name: string } | null>(null);

  // Keep the URL in step with the choices that are safe to put in it.
  useEffect(() => {
    const q = new URLSearchParams();
    if (step !== 1) q.set("step", String(step));
    if (modules.length > 0) q.set("modules", modules.join(","));
    q.set("currency", currency);
    router.replace(`/get-started?${q.toString()}`, { scroll: false });
  }, [step, modules, currency, router]);

  const tier = tierFor(modules.length);
  const price = tier ? pricing.ladder[currency][tier] : 0;
  const moduleInfo = (key: ModuleKey) => pricing.modules.find((m) => m.key === key);

  const toggle = (key: ModuleKey) =>
    setModules(
      modules.includes(key)
        ? modules.filter((k) => k !== key)
        : [...modules, key].sort((a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b)),
    );

  const set = (key: keyof OnboardingDetails) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = key === "acceptTerms" ? e.target.checked : e.target.value;
    setDetails({ ...details, [key]: value });
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  function validateDetails(): boolean {
    const next: typeof errors = {};
    if (!details.organisationName.trim()) next.organisationName = "Enter your organisation's name.";
    if (!details.name.trim()) next.name = "Enter your full name.";
    if (!details.email.trim()) next.email = "Enter your work email.";
    else if (!EMAIL.test(details.email.trim())) next.email = "Enter a valid email address, like you@company.com.";
    const digits = details.phone.replace(/\D/g, "");
    if (!details.phone.trim()) next.phone = "Enter a phone number.";
    else if (digits.length < 7) next.phone = "Enter a full phone number, including the country code.";
    // A request commits nobody to anything; the terms come with the invoice.
    if (!requestMode && !details.acceptTerms) next.acceptTerms = "Confirm you can buy on your organisation's behalf.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goTo(next: Step) {
    if (next === 3 && !validateDetails()) return;
    if (next >= 2) writeStored({ details: { ...details, website: "" }, modules, currency });
    setPayError(null);
    setStep(next);
  }

  async function pay() {
    if (!validateDetails()) {
      setStep(2);
      return;
    }
    setPaying(true);
    setPayError(null);
    setExistingAccount(false);
    writeStored({ details: { ...details, website: "" }, modules, currency });
    try {
      const result = await onboarding.checkout({
        ...details,
        organisationName: details.organisationName.trim(),
        name: details.name.trim(),
        email: details.email.trim(),
        phone: details.phone.trim(),
        modules,
        currency,
      });
      try {
        window.sessionStorage.setItem(
          CLAIM_STORAGE_KEY,
          JSON.stringify({ reference: result.reference, claimToken: result.claimToken }),
        );
      } catch {
        /* without storage the admin signs in from the welcome email instead */
      }
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setPaying(false);
      if (error instanceof PublicApiError && Object.keys(error.errors).length > 0) {
        const fieldErrors: typeof errors = {};
        for (const key of ["organisationName", "name", "email", "phone", "acceptTerms"] as const) {
          if (error.errors[key]?.[0]) fieldErrors[key] = error.errors[key][0];
        }
        setErrors(fieldErrors);
        setExistingAccount(Boolean(error.errors.email?.[0]?.toLowerCase().includes("already")));
        if (Object.keys(fieldErrors).length > 0) {
          setStep(2);
          return;
        }
        setPayError(error.errors.modules?.[0] ?? error.errors.currency?.[0] ?? error.message);
        return;
      }
      setPayError(error instanceof Error ? error.message : "We couldn't start the payment. Try again.");
    }
  }

  async function sendRequest() {
    if (!validateDetails()) {
      setStep(2);
      return;
    }
    setPaying(true);
    setPayError(null);
    setExistingAccount(false);
    writeStored({ details: { ...details, website: "" }, modules, currency });
    try {
      const result = await salesRequests.create({
        type: "licence",
        organisationName: details.organisationName.trim(),
        name: details.name.trim(),
        email: details.email.trim(),
        phone: details.phone.trim(),
        message: message.trim() || undefined,
        modules,
        currency,
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
        setPayError(error.errors.modules?.[0] ?? error.errors.message?.[0] ?? error.errors.currency?.[0] ?? error.message);
        return;
      }
      setPayError(
        error instanceof PublicApiError ? error.message : "We couldn't send your request. Check your connection and try again.",
      );
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* ---------- progress ---------- */}
      <nav aria-label="Onboarding progress">
        <ol className="flex items-center gap-2 sm:gap-4">
          {steps.map((s, i) => {
            const done = step > s.n || sent !== null;
            const current = step === s.n && sent === null;
            return (
              <li key={s.n} className="flex flex-1 items-center gap-2 sm:gap-3" aria-current={current ? "step" : undefined}>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    done
                      ? "bg-primary-600 text-white"
                      : current
                        ? "border-2 border-primary-600 bg-white text-primary-700"
                        : "border border-neutral-300 bg-white text-neutral-500"
                  }`}
                >
                  {done ? <Check size={16} aria-hidden="true" /> : s.n}
                </span>
                <span className={`text-sm font-medium ${current ? "text-neutral-900" : "text-neutral-500"} hidden sm:inline`}>
                  <span className="sr-only">Step {s.n} of 3: </span>
                  {s.label}
                </span>
                <span className="sr-only sm:hidden">
                  Step {s.n} of 3: {s.label}
                </span>
                {i < steps.length - 1 && <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* ---------- the step ---------- */}
        <div className="lg:col-span-2">
          {sent !== null && (
            <RequestSent reference={sent.reference} email={sent.email} firstName={sent.name.split(/\s+/)[0]} />
          )}

          {sent === null && step === 1 && (
            <section aria-labelledby={`${uid}-s1`}>
              <h2 id={`${uid}-s1`} className="heading-4 text-neutral-900">
                Choose your modules
              </h2>
              <p className="mt-2 text-neutral-600">
                {requestMode
                  ? "Pick any combination. The price depends only on how many you take. It's a one-time price, invoiced once our team confirms your modules."
                  : "Pick any combination. The price depends only on how many you take, and it's a one-time payment."}
              </p>

              {pricing.currencies.length > 1 && (
                <div role="radiogroup" aria-label="Currency" className="mt-6 inline-flex rounded-full border border-neutral-200 bg-white p-1">
                  {pricing.currencies.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={currency === c}
                      onClick={() => setCurrency(c)}
                      className={`min-h-11 rounded-full px-5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        currency === c ? "bg-primary-600 text-white" : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      {c === "NGN" ? "Naira (₦)" : "US dollars ($)"}
                    </button>
                  ))}
                </div>
              )}

              <fieldset className="mt-6">
                <legend className="sr-only">Modules</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {pricing.modules.map((m) => {
                    const checked = modules.includes(m.key);
                    return (
                      <label
                        key={m.key}
                        className={`relative flex cursor-pointer flex-col rounded-2xl border bg-white p-5 transition-colors focus-within:ring-2 focus-within:ring-primary-500 ${
                          checked ? "border-primary-500 ring-1 ring-primary-500" : "border-neutral-200 hover:border-neutral-300"
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

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  disabled={modules.length === 0}
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
            <section aria-labelledby={`${uid}-s2`}>
              <h2 id={`${uid}-s2`} className="heading-4 text-neutral-900">
                Your organisation and your details
              </h2>
              <p className="mt-2 text-neutral-600">
                You&apos;ll be your organisation&apos;s admin: you&apos;ll sign in first, add colleagues and give them
                roles.
              </p>
              {requestMode && (
                <p className="mt-3 text-sm text-neutral-600">
                  Already on Elevate?{" "}
                  <Link href="/login?redirect=/suite/org/billing" className="font-semibold text-primary-700 underline-offset-2 hover:underline">
                    Sign in
                  </Link>{" "}
                  and request more modules from Plan &amp; billing.
                </p>
              )}

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
                  hint={requestMode ? "Your confirmation, invoice and sign-in details go here." : "Your sign-in details and receipt go here."}
                  value={details.email}
                  onChange={set("email")}
                  error={errors.email}
                />
                {existingAccount && (
                  <p className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
                    Already on Elevate?{" "}
                    <Link
                      href={`/login?email=${encodeURIComponent(details.email)}&redirect=/suite/org/billing`}
                      className="font-semibold underline underline-offset-2"
                    >
                      Sign in
                    </Link>{" "}
                    and {requestMode ? "request" : "add"} modules from Plan &amp; billing.
                  </p>
                )}

                {!requestMode && (
                  <div>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={details.acceptTerms}
                        onChange={set("acceptTerms")}
                        aria-invalid={errors.acceptTerms ? true : undefined}
                        aria-describedby={errors.acceptTerms ? `${uid}-terms-error` : undefined}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-primary-600"
                      />
                      <span>
                        I&apos;m authorised to buy for this organisation, and I agree to Elevate&apos;s licence terms for a
                        one-time purchase.
                      </span>
                    </label>
                    {errors.acceptTerms && (
                      <p id={`${uid}-terms-error`} role="alert" className="mt-1.5 text-xs font-medium text-error-600">
                        {errors.acceptTerms}
                      </p>
                    )}
                  </div>
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

                <div className="flex items-center justify-between gap-3 pt-4">
                  <button type="button" onClick={() => goTo(1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back
                  </button>
                  <button type="submit" className="btn-primary min-h-11 gap-2">
                    {requestMode ? "Review your request" : "Review your order"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </form>
            </section>
          )}

          {sent === null && step === 3 && (
            <section aria-labelledby={`${uid}-s3`}>
              <h2 id={`${uid}-s3`} className="heading-4 text-neutral-900">
                {requestMode ? "Review and send" : "Review and pay"}
              </h2>
              <p className="mt-2 text-neutral-600">
                {requestMode
                  ? "Check the details. Nothing is charged now: our team confirms your modules with you, agrees payment and switches them on."
                  : "Check the details. You'll pay on our payment partner's secure page and come straight back."}
              </p>

              <dl className="mt-6 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                {[
                  ["Organisation", details.organisationName],
                  ["Admin", details.name],
                  ["Email", details.email],
                  ["Phone", details.phone],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap justify-between gap-2 px-5 py-4 text-sm">
                    <dt className="text-neutral-500">{label}</dt>
                    <dd className="font-medium text-neutral-900">{value}</dd>
                  </div>
                ))}
              </dl>

              {requestMode && (
                <div className="mt-6">
                  <FormField id={`${uid}-message`} label="Anything we should know?" optional>
                    <textarea
                      id={`${uid}-message`}
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Timelines, how many people, questions about payment…"
                      className={`${INPUT_CLASS} resize-y`}
                    />
                  </FormField>
                </div>
              )}

              {payError && (
                <p role="alert" className="mt-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600">
                  {payError}
                </p>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button type="button" onClick={() => goTo(2)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back
                </button>
                {requestMode ? (
                  <button type="button" onClick={sendRequest} disabled={paying} className="btn-primary min-h-11 gap-2 disabled:opacity-70">
                    {paying ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                    {paying ? "Sending request…" : "Send request"}
                  </button>
                ) : (
                  <button type="button" onClick={pay} disabled={paying} className="btn-primary min-h-11 gap-2 disabled:opacity-70">
                    {paying ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                    {paying ? "Opening secure checkout…" : `Pay ${formatMoney(price, currency)}`}
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        {/* ---------- order summary ---------- */}
        <aside aria-label="Order summary" className="h-fit rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">{requestMode ? "Your request" : "Your order"}</h2>
          {modules.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Choose at least one module to see the price.</p>
          ) : (
            <>
              <ul className="mt-4 space-y-2 text-sm">
                {modules.map((key) => {
                  const m = moduleInfo(key);
                  return (
                    <li key={key} className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-2 text-neutral-800">
                        <Check size={14} className="text-primary-600" aria-hidden="true" />
                        {m?.label ?? key}
                      </span>
                      {m?.status === "coming_soon" && <span className="text-xs text-neutral-500">When released</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 border-t border-neutral-100 pt-4">
                <p className="flex items-baseline justify-between">
                  <span className="text-sm text-neutral-600">
                    {modules.length} {modules.length === 1 ? "module" : "modules"}
                  </span>
                  <span className="font-heading text-2xl font-bold tabular-nums text-neutral-900" aria-live="polite">
                    {formatMoney(price, currency)}
                  </span>
                </p>
                <p className="label-mono mt-1 text-right text-neutral-500">
                  {requestMode ? "One-time · invoiced, not charged now" : "One-time · no renewals"}
                </p>
              </div>
            </>
          )}
          <p className="mt-5 flex items-start gap-2 text-xs text-neutral-500">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary-600" aria-hidden="true" />
            {requestMode ? (
              <span>Nothing is charged online. You&apos;re invoiced for this one-time price once our team confirms your modules.</span>
            ) : (
              <span>
                Card details go to {pricing.gateway?.label ?? "our payment partner"}, never to Elevate.
                {pricing.gateway?.testMode && (
                  <span className="ml-1 rounded-full bg-accent-400/30 px-2 py-0.5 font-semibold text-accent-700">Test mode</span>
                )}
              </span>
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}

/** A real sequence, so the numbers carry order. The first has already happened. */
const NEXT_STEPS = [
  { title: "Confirmation email", body: "A copy of your request, with its reference, is on its way to your inbox." },
  { title: "We confirm the details", body: "Our team contacts you to confirm the modules and agree payment of the one-time price." },
  { title: "Your modules go live", body: "We switch them on, and you sign in as your organisation's admin." },
] as const;

/** The wizard's last state while payment is off: the request is in, and here is what follows. */
function RequestSent({ reference, email, firstName }: { reference: string; email: string; firstName?: string }) {
  const uid = useId();
  return (
    <section role="status" aria-labelledby={`${uid}-title`} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <CheckCircle2 className="h-11 w-11 text-primary-600" aria-hidden="true" />
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-right">
          <span className="label-mono block text-neutral-500">Reference</span>
          <span className="font-mono text-base font-semibold tracking-wide text-neutral-900">{reference}</span>
        </p>
      </div>
      <h2 id={`${uid}-title`} className="heading-4 mt-5 text-neutral-900">
        Request sent{firstName ? `, ${firstName}` : ""}
      </h2>
      <p className="mt-2 leading-relaxed text-neutral-600">
        A confirmation email is on its way to <span className="font-medium text-neutral-800">{email}</span>. Quote the
        reference whenever you get in touch.
      </p>

      <h3 className="label-mono mt-8 text-neutral-500">What happens next</h3>
      <ol className="mt-4 space-y-5">
        {NEXT_STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                i === 0 ? "bg-primary-600 text-white" : "border border-neutral-300 bg-white text-neutral-600"
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

      <div className="mt-8 flex flex-wrap gap-3 border-t border-neutral-100 pt-6">
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
