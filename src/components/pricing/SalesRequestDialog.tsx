"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { FormField, INPUT_CLASS } from "./FormField";
import {
  PublicApiError,
  salesRequests,
  type Currency,
  type SalesRequestType,
} from "@/lib/api/public-pricing";

type Copy = { title: string; intro: string; messageLabel: string; submit: string };

const COPY: Record<SalesRequestType, Copy> = {
  source_code: {
    title: "Own the full source code",
    intro:
      "Tell us about your company and where you plan to host XwiftHQ. Our team sends the licence agreement and an invoice, then hands over the codebase.",
    messageLabel: "Where will you run it, and what do you need to change?",
    submit: "Request the source code",
  },
  dedicated_hosting: {
    title: "A dedicated server and your own domain",
    intro:
      "Your data on a server of its own, at an address on your domain. Our technical team will size it with you, quote the yearly cost and walk with you all the way to go-live.",
    messageLabel: "Roughly how many people, and which domain?",
    submit: "Talk to the technical team",
  },
  enterprise: {
    title: "Talk to us",
    intro: "Rolling out to a large team, running several organisations, or need something the price list does not cover? Tell us and we will get back to you.",
    messageLabel: "What do you need?",
    submit: "Send enquiry",
  },
  // Only sent by the onboarding wizard (it carries the modules); here for completeness.
  licence: {
    title: "Request your modules",
    intro:
      "Our team will confirm the modules with you, send an invoice for the one-time price and switch them on.",
    messageLabel: "Anything we should know?",
    submit: "Send request",
  },
};

/**
 * The request form behind "by request" offers: the plans on the pricing page,
 * a dedicated server, and general enterprise enquiries.
 *
 * `plan` is the price-page choice the visitor made (say, "XwiftHQ Cloud, 3
 * modules, Nigeria price list"). It is shown in the dialog and sent at the
 * top of the message, so the team quotes what the visitor was looking at.
 * `copy` overrides the type's wording for a particular button.
 *
 * Nothing is paid here. The request lands in the platform owner's console and
 * inbox, and the XwiftHQ team takes it from there: the owner's decision for anything
 * that ends in a licence agreement or a server of its own.
 */
export function SalesRequestDialog({
  type,
  open,
  onClose,
  currency = "NGN",
  plan,
  copy: override,
}: {
  type: SalesRequestType;
  open: boolean;
  onClose: () => void;
  currency?: Currency;
  plan?: string;
  copy?: Partial<Copy>;
}) {
  const uid = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const [values, setValues] = useState({ name: "", email: "", phone: "", organisationName: "", message: "", website: "" });
  const [cur, setCur] = useState<Currency>(currency);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const copy = { ...COPY[type], ...override };
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const err = (key: string) => errors[key]?.[0] ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSending(true);
    try {
      const message = [plan, values.message.trim()].filter(Boolean).join("\n\n");
      await salesRequests.create({ type, ...values, message: message || undefined, currency: cur });
      setSent(true);
    } catch (error) {
      if (error instanceof PublicApiError) {
        setErrors(error.errors);
        if (Object.keys(error.errors).length === 0) setFormError(error.message);
      } else {
        setFormError("We couldn't send that. Check your connection and try again.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-neutral-900/50 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="relative mt-auto w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-[0_40px_80px_-30px_rgb(150_56_205/0.55)] sm:mb-auto sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {sent ? (
          <div className="py-6 text-center" role="status">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary-600" aria-hidden="true" />
            <h2 id={`${uid}-title`} className="font-heading mt-4 text-2xl font-semibold text-neutral-900">
              Request received
            </h2>
            <p className="mt-3 leading-relaxed text-neutral-600">
              Thank you, {values.name.split(" ")[0] || "there"}. Our team will contact you at{" "}
              <span className="font-medium text-neutral-800">{values.email}</span>.
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-6">
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 id={`${uid}-title`} className="font-heading pr-10 text-2xl font-semibold text-neutral-900">
              {copy.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{copy.intro}</p>
            {plan && (
              <p className="mt-4 rounded-xl bg-primary-50 px-4 py-3 text-sm font-medium text-primary-800">{plan}</p>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {formError && (
                <p role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600">
                  {formError}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id={`${uid}-name`} label="Full name" error={err("name")}>
                  <input
                    ref={firstField}
                    id={`${uid}-name`}
                    autoComplete="name"
                    required
                    value={values.name}
                    onChange={set("name")}
                    aria-invalid={err("name") ? true : undefined}
                    aria-describedby={err("name") ? `${uid}-name-error` : undefined}
                    className={INPUT_CLASS}
                  />
                </FormField>
                <FormField
                  id={`${uid}-org`}
                  label="Organisation"
                  autoComplete="organization"
                  required
                  value={values.organisationName}
                  onChange={set("organisationName")}
                  error={err("organisationName")}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id={`${uid}-email`}
                  label="Work email"
                  type="email"
                  autoComplete="email"
                  required
                  value={values.email}
                  onChange={set("email")}
                  error={err("email")}
                />
                <FormField
                  id={`${uid}-phone`}
                  label="Phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  placeholder="+234 803 000 0000"
                  value={values.phone}
                  onChange={set("phone")}
                  error={err("phone")}
                />
              </div>
              <FormField id={`${uid}-message`} label={copy.messageLabel} optional error={err("message")}>
                <textarea
                  id={`${uid}-message`}
                  rows={3}
                  value={values.message}
                  onChange={set("message")}
                  className={`${INPUT_CLASS} resize-y`}
                />
              </FormField>
              <FormField id={`${uid}-currency`} label="Invoice currency">
                <SearchableSelect
                  id={`${uid}-currency`}
                  value={cur}
                  onChange={(v) => setCur(v as Currency)}
                  options={[
                    { value: "NGN", label: "Naira (₦)" },
                    { value: "USD", label: "US dollars ($)" },
                  ]}
                />
              </FormField>

              {/* Honeypot: invisible to people, irresistible to bots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor={`${uid}-website`}>Website</label>
                <input
                  id={`${uid}-website`}
                  tabIndex={-1}
                  autoComplete="off"
                  value={values.website}
                  onChange={set("website")}
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="btn-primary w-full disabled:opacity-70"
              >
                {sending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {sending ? "Sending…" : copy.submit}
              </button>
              <p className="text-center text-xs text-neutral-500">Nothing is charged. Our team will reply by email.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
