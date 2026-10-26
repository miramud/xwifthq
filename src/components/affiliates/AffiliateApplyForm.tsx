"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react";
import { FormField, INPUT_CLASS } from "@/components/pricing/FormField";
import { ApiError, publicAffiliates } from "@/lib/api/affiliate-client";
import { useAuth } from "@/lib/auth-store";

interface Values {
  name: string;
  email: string;
  phone: string;
  country: string;
  audienceUrl: string;
  promotion: string;
  acceptTerms: boolean;
  /** Honeypot: must stay empty. */
  website: string;
}

type Field = Exclude<keyof Values, "website">;

const EMPTY: Values = {
  name: "",
  email: "",
  phone: "",
  country: "",
  audienceUrl: "",
  promotion: "",
  acceptTerms: false,
  website: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROMOTION_MIN = 20;

/** The API accepts a full https address only; this says so before it has to. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The application to join the affiliate programme.
 *
 * Nothing is decided here: the application lands with the platform team, who
 * review it by hand and email the applicant either way. Somebody signed in
 * starts with their name and email filled in, and an approved affiliate is
 * pointed at their dashboard instead of being asked to apply again.
 */
export function AffiliateApplyForm({ termsHref = "#terms" }: { termsHref?: string }) {
  const uid = useId();
  const { user } = useAuth();

  // `null` until the person types: until then the signed-in account fills the
  // name and email, without copying it into state from an effect.
  const [valuesState, setValues] = useState<Values | null>(null);
  const values = valuesState ?? { ...EMPTY, name: user?.name ?? "", email: user?.email ?? "" };

  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null);

  if (user?.affiliate) {
    return (
      <div className="xw-glow-card p-6 sm:p-8">
        <h3 className="xw-h3">You&apos;re already an affiliate</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Your link, your referrals and what you have earned are on your affiliate dashboard.
        </p>
        <Link href="/suite/affiliate" className="btn-primary mt-6 min-h-11 gap-2">
          Open your dashboard
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div role="status" className="xw-glow-card p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary-600" aria-hidden="true" />
        <h3 className="font-heading mt-4 text-2xl font-semibold text-neutral-900">Application received</h3>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-neutral-600">
          Thank you, {sent.name.split(/\s+/)[0] || "there"}. Our team reviews every application by hand and will
          email you at <span className="font-medium text-neutral-800">{sent.email}</span> once it has decided. If
          you&apos;re approved, that email has your link, your code and how to sign in.
        </p>
      </div>
    );
  }

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = key === "acceptTerms" ? (e.target as HTMLInputElement).checked : e.target.value;
    setValues({ ...values, [key]: value });
    if (key !== "website") setErrors((er) => ({ ...er, [key]: undefined }));
  };

  function validate(): boolean {
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = "Enter your full name.";
    if (!values.email.trim()) next.email = "Enter your email address.";
    else if (!EMAIL.test(values.email.trim())) next.email = "Enter a valid email address, like you@company.com.";
    const url = values.audienceUrl.trim();
    if (url && !isHttpsUrl(url)) next.audienceUrl = "Enter the full address, starting with https://";
    if (values.promotion.trim().length < PROMOTION_MIN)
      next.promotion = `Tell us a little more: at least ${PROMOTION_MIN} characters.`;
    if (!values.acceptTerms) next.acceptTerms = "Accept the programme terms to apply.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSending(true);
    try {
      await publicAffiliates.apply({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || undefined,
        country: values.country.trim() || undefined,
        audienceUrl: values.audienceUrl.trim() || undefined,
        promotion: values.promotion.trim(),
        acceptTerms: values.acceptTerms,
        website: values.website,
      });
      setSent({ name: values.name.trim(), email: values.email.trim() });
    } catch (error) {
      if (error instanceof ApiError && error.errors && Object.keys(error.errors).length > 0) {
        const fieldErrors: typeof errors = {};
        for (const key of ["name", "email", "phone", "country", "audienceUrl", "promotion", "acceptTerms"] as const) {
          if (error.errors[key]?.[0]) fieldErrors[key] = error.errors[key][0];
        }
        setErrors(fieldErrors);
        if (Object.keys(fieldErrors).length === 0) setFormError(error.message);
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("We couldn't send your application. Check your connection and try again.");
      }
    } finally {
      setSending(false);
    }
  }

  const describedBy = (key: Field, hint = false) =>
    [hint ? `${uid}-${key}-hint` : null, errors[key] ? `${uid}-${key}-error` : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <form onSubmit={submit} noValidate className="xw-frame relative space-y-4 p-5 sm:p-8">
      {formError && (
        <p role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600">
          {formError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${uid}-name`}
          label="Full name"
          autoComplete="name"
          value={values.name}
          onChange={set("name")}
          error={errors.name}
        />
        <FormField
          id={`${uid}-email`}
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={set("email")}
          error={errors.email}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={`${uid}-phone`}
          label="Phone"
          type="tel"
          autoComplete="tel"
          optional
          placeholder="+234 803 000 0000"
          value={values.phone}
          onChange={set("phone")}
          error={errors.phone}
        />
        <FormField
          id={`${uid}-country`}
          label="Country"
          autoComplete="country-name"
          optional
          value={values.country}
          onChange={set("country")}
          error={errors.country}
        />
      </div>
      <FormField
        id={`${uid}-audienceUrl`}
        label="Your website or profile"
        type="url"
        inputMode="url"
        autoComplete="url"
        optional
        placeholder="https://"
        hint="Where people find you: your site, LinkedIn page or newsletter."
        value={values.audienceUrl}
        onChange={set("audienceUrl")}
        error={errors.audienceUrl}
      />
      <FormField
        id={`${uid}-promotion`}
        label="How would you promote XwiftHQ?"
        hint="Who you advise, and how you would introduce XwiftHQ to them."
        error={errors.promotion}
      >
        <textarea
          id={`${uid}-promotion`}
          rows={4}
          value={values.promotion}
          onChange={set("promotion")}
          aria-invalid={errors.promotion ? true : undefined}
          aria-describedby={describedBy("promotion", true)}
          className={`${INPUT_CLASS} resize-y`}
        />
      </FormField>

      <div>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={values.acceptTerms}
            onChange={set("acceptTerms")}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={describedBy("acceptTerms")}
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary-600"
          />
          <span>
            I accept the{" "}
            <a
              href={termsHref}
              className="rounded font-semibold text-primary-700 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              programme terms
            </a>
            .
          </span>
        </label>
        {errors.acceptTerms && (
          <p id={`${uid}-acceptTerms-error`} role="alert" className="mt-1.5 text-xs font-medium text-error-600">
            {errors.acceptTerms}
          </p>
        )}
      </div>

      {/* Honeypot: invisible to people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input id={`${uid}-website`} tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
      </div>

      <button type="submit" disabled={sending} className="btn-primary min-h-11 w-full gap-2 disabled:opacity-70">
        {sending ? (
          <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Send size={16} aria-hidden="true" />
        )}
        {sending ? "Sending…" : "Send application"}
      </button>
      <p className="text-center text-xs text-neutral-500">Our team reviews every application by hand and replies by email.</p>
    </form>
  );
}
