"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { AUTH_INPUT, AuthHeading, AuthShell } from "@/components/site/AuthShell";
import { useAuth } from "@/lib/auth-store";

/**
 * Where an invited account lands, and cannot leave until it has a password.
 *
 * Somebody assigned a course before they had an account is emailed a generated
 * password. That password has travelled through an inbox, so the API treats the
 * account as unsecured: every route except this one answers 403 with
 * `password_change_required`. The screen exists so the holder meets an
 * explanation and one field rather than a wall of failures.
 *
 * Three things it deliberately does:
 *
 *  • **Asks for the temporary password.** It is the only proof that the person
 *    typing is the one who received the email, and the API requires it.
 *  • **Refuses to be skipped.** There is no "later": nothing else works, so
 *    offering one would be a lie. Signing out is the only way past.
 *  • **Sends them where they were going.** `?redirect=` carries the course
 *    they were invited to, so the last step of the invitation is the thing
 *    they were told about rather than a dashboard.
 */
function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, refresh, logout } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirect = params.get("redirect") ?? "/my-courses";

  useEffect(() => {
    document.title = "Choose your password | XwiftHQ";
  }, []);

  // Nobody who has already chosen a password should be held here.
  useEffect(() => {
    if (!loading && user !== null && !user.mustChangePassword) {
      router.replace(redirect);
    }
  }, [loading, user, redirect, router]);

  useEffect(() => {
    if (!loading && user === null) {
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [loading, user, redirect, router]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (saving) return;

      if (next !== confirm) {
        setError("The two new passwords do not match.");
        return;
      }

      if (next.length < 8) {
        setError("Use at least 8 characters.");
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const res = await fetch("/api/auth/password", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            currentPassword: current,
            password: next,
            password_confirmation: confirm,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));

          // Laravel's validation shape: surface the field message rather than
          // the generic "the given data was invalid".
          const fieldError =
            body.errors !== undefined
              ? Object.values(body.errors as Record<string, string[]>)[0]?.[0]
              : undefined;

          setError(fieldError ?? body.message ?? "Could not set your password.");
          return;
        }

        // The session's `mustChangePassword` has just become false, and the
        // effect above then moves them on.
        await refresh();
        router.replace(redirect);
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      } finally {
        setSaving(false);
      }
    },
    [saving, current, next, confirm, refresh, router, redirect],
  );

  if (loading || user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500 motion-reduce:animate-none" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <AuthShell>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 ring-1 ring-primary-100">
        <KeyRound className="h-6 w-6 text-primary-600" aria-hidden="true" />
      </div>

      <AuthHeading
        title="Choose your password"
        intro={
          <>
            {user.organisationName ?? "Your organisation"} set up this account for you and emailed a temporary
            password. Swap it for one of your own to carry on. The emailed one stops working the moment you do.
          </>
        }
      />

      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="current" className="mb-1.5 block text-sm font-medium text-neutral-800">
            Temporary password
          </label>
          <div className="relative">
            <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              id="current"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              aria-describedby="current-hint"
              className={AUTH_INPUT}
            />
          </div>
          <p id="current-hint" className="mt-1.5 text-xs text-neutral-500">
            You&apos;ll find it in your invitation email.
          </p>
        </div>

        <div>
          <label htmlFor="next" className="mb-1.5 block text-sm font-medium text-neutral-800">
            New password
          </label>
          <div className="relative">
            <KeyRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              id="next"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              aria-describedby="next-hint"
              className={AUTH_INPUT}
            />
          </div>
          <p id="next-hint" className="mt-1.5 text-xs text-neutral-500">
            At least 8 characters.
          </p>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-neutral-800">
            Confirm new password
          </label>
          <div className="relative">
            <KeyRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={AUTH_INPUT}
            />
          </div>
        </div>

        {error !== null && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-error-500/20 bg-error-500/10 px-4 py-3 text-sm text-error-700"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="btn-primary h-12 w-full disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {saving ? "Saving…" : "Set password and continue"}
        </button>
      </form>

      {/*
        The only way past this screen other than finishing it. Offering a
        "later" would be false: nothing else in the product works yet.
      */}
      <button
        type="button"
        onClick={() => void logout().then(() => router.replace("/login"))}
        className="mx-auto mt-6 block rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        Sign out instead
      </button>
    </AuthShell>
  );
}

/**
 * `useSearchParams` suspends, so the form sits behind a boundary. Otherwise
 * the page cannot be prerendered at build time.
 */
export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm />
    </Suspense>
  );
}
