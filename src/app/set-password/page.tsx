"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
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
 *  • **Refuses to be skipped.** There is no "later" — nothing else works, so
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
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400 motion-reduce:animate-none" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-20">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
        <KeyRound className="h-6 w-6 text-primary-600" aria-hidden="true" />
      </div>

      <h1 className="font-heading text-2xl font-bold text-neutral-900">
        Choose your password
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        {user.organisationName ?? "Your organisation"} created this account for you and emailed
        you a temporary password. Replace it to carry on — the emailed one stops working as soon
        as you do.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="current" className="block text-sm font-medium text-neutral-700">
            Temporary password
          </label>
          <input
            id="current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          <p className="mt-1 text-xs text-neutral-500">
            From the email that invited you.
          </p>
        </div>

        <div>
          <label htmlFor="next" className="block text-sm font-medium text-neutral-700">
            New password
          </label>
          <input
            id="next"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-describedby="next-hint"
            className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          <p id="next-hint" className="mt-1 text-xs text-neutral-500">
            At least 8 characters.
          </p>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-neutral-700">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>

        {error !== null && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-700"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="btn-primary w-full justify-center gap-2 py-3 disabled:opacity-70 disabled:cursor-wait"
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
        "later" would be false — nothing else in the product works yet.
      */}
      <button
        type="button"
        onClick={() => void logout().then(() => router.replace("/login"))}
        className="mt-6 w-full text-center text-xs font-medium text-neutral-500 hover:text-neutral-700"
      >
        Sign out instead
      </button>
    </div>
  );
}

/**
 * `useSearchParams` suspends, so the form sits behind a boundary — otherwise
 * the page cannot be prerendered at build time.
 */
export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm />
    </Suspense>
  );
}
