"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Mail, MailCheck, Send } from "lucide-react";
import { AUTH_INPUT, AuthHeading, AuthShell } from "@/components/site/AuthShell";

const COOLDOWN_SECONDS = 60;

/**
 * Asking for a password reset link.
 *
 * The page never says whether the address has an account. The API answers
 * the same way either way, and so does this screen: telling a stranger
 * "no account for that email" would let anybody test which addresses are
 * registered. So the confirmation is phrased as "if", and it is shown for
 * every well-formed address.
 *
 * "Send again" waits a minute. The API throttles too; the wait here stops
 * somebody hammering the button and meeting a refusal instead of an email.
 */
function ForgotPasswordForm() {
  const params = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    document.title = "Reset your password | XwiftHQ";
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function send(address: string) {
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (!res.ok) {
        setError(body.errors?.email?.[0] ?? body.message ?? "We couldn't send the link. Try again.");
        return;
      }

      setSentTo(address);
      setMessage(body.message ?? null);
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (address === "" || sending) return;
    void send(address);
  }

  return (
    <AuthShell>
      {sentTo === null ? (
        <>
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 ring-1 ring-primary-100">
            <Mail className="h-6 w-6 text-primary-600" aria-hidden="true" />
          </div>
          <AuthHeading
            title="Forgot your password?"
            intro="Type the email you sign in with. We'll send a link so you can pick a new password."
          />

          {error && (
            <div role="alert" className="mb-5 rounded-xl border border-error-500/20 bg-error-500/10 px-4 py-3 text-sm text-error-700">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-800">
                Email address
              </label>
              <div className="relative">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={AUTH_INPUT}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={sending || email.trim() === ""}
              aria-busy={sending}
              className="btn-primary h-12 w-full disabled:opacity-70"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
              {sending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      ) : (
        <div aria-live="polite">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-50 ring-1 ring-success-200">
            <MailCheck className="h-6 w-6 text-success-600" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-[2rem] font-bold leading-tight tracking-[-0.03em] text-neutral-900">
            Check your email
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            {message ?? "If an account exists for that address, a reset link is on its way."}
          </p>
          <p className="mt-4 break-all rounded-xl bg-primary-50/70 px-4 py-3 text-sm font-medium text-neutral-900">
            {sentTo}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-neutral-500">
            <li>The link stays valid for 60 minutes.</li>
            <li>Nothing yet? Look in your spam or junk folder.</li>
          </ul>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-error-500/20 bg-error-500/10 px-4 py-3 text-sm text-error-700">
              {error}
            </div>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void send(sentTo)}
              disabled={cooldown > 0 || sending}
              aria-busy={sending}
              className="btn-primary h-12 flex-1 px-4 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
              {cooldown > 0 ? `Send again in ${cooldown}s` : "Send again"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
              className="btn-outline h-12 flex-1 px-4"
            >
              Use a different email
            </button>
          </div>
        </div>
      )}

      <p className="mt-8 text-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded font-semibold text-primary-700 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

/** `useSearchParams` suspends, so the form sits behind a boundary. */
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
