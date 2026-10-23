"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Mail, MailCheck, Send } from "lucide-react";

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
    document.title = "Reset your password | Elevate";
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
    <section className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          {sentTo === null ? (
            <>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
                <Mail className="h-6 w-6 text-primary-600" aria-hidden="true" />
              </div>
              <h1 className="heading-4 mb-1 text-neutral-900" style={{ fontFamily: "var(--font-heading)" }}>
                Forgot your password?
              </h1>
              <p className="mb-6 text-sm text-neutral-500">
                Enter the email you sign in with and we&apos;ll send you a link to choose a new one.
              </p>

              {error && (
                <div role="alert" className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600">
                  {error}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-neutral-200 py-2.5 pl-10 pr-4 text-sm text-neutral-700 placeholder-neutral-400 transition-colors focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending || email.trim() === ""}
                  aria-busy={sending}
                  className="btn-primary w-full gap-2 py-3 text-sm font-semibold disabled:opacity-70"
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
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-50">
                <MailCheck className="h-6 w-6 text-success-600" aria-hidden="true" />
              </div>
              <h1 className="heading-4 mb-1 text-neutral-900" style={{ fontFamily: "var(--font-heading)" }}>
                Check your email
              </h1>
              <p className="text-sm text-neutral-600">
                {message ?? "If an account exists for that address, we've sent a link to reset its password."}
              </p>
              <p className="mt-3 break-all rounded-lg bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-neutral-800">
                {sentTo}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-neutral-500">
                <li>The link works for 60 minutes.</li>
                <li>Nothing yet? Check your spam or junk folder.</li>
              </ul>

              {error && (
                <div role="alert" className="mt-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600">
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void send(sentTo)}
                  disabled={cooldown > 0 || sending}
                  aria-busy={sending}
                  className="btn-primary flex-1 gap-2 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="flex-1 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-sm">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-700"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
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
