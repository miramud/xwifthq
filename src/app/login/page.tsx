"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { AUTH_INPUT, AuthHeading, AuthShell } from "@/components/site/AuthShell";
import { useAuth, AuthError, type AuthUser } from "@/lib/auth-store";
import { landingFor } from "@/lib/roles";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // An explicit `?redirect=` (a course link from an invitation, a page that
  // sent them here) wins; otherwise each kind of account has its own landing.
  const requested = params.get("redirect");
  const landing = (who: AuthUser | null) => requested || landingFor(who);
  const { login, isAuthenticated, loading, user } = useAuth();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Log in | XwiftHQ";
  }, []);

  /*
    An account still on its emailed temporary password goes to /set-password
    first. The API refuses everything else until it is replaced, so sending
    them anywhere else would be sending them into a wall of 403s. `redirect`
    is carried through, so the course they were invited to is still where they
    end up.
  */
  const destination =
    user?.mustChangePassword === true
      ? `/set-password?redirect=${encodeURIComponent(landing(user))}`
      : landing(user);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace(destination);
  }, [loading, isAuthenticated, destination, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await login(email, password);

      router.replace(
        signedIn.mustChangePassword
          ? `/set-password?redirect=${encodeURIComponent(landing(signedIn))}`
          : landing(signedIn),
      );
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Login failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Welcome back"
        intro="Log in to your company's XwiftHQ workspace and pick up where you left off."
      />

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-800">
            Work email
          </label>
          <div className="relative">
            <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={AUTH_INPUT}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-medium text-neutral-800">
              Password
            </label>
            {/* Carries whatever has been typed so the next page needn't ask again. */}
            <Link
              href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
              className="rounded text-xs font-semibold text-primary-700 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={AUTH_INPUT}
            />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary h-12 w-full disabled:opacity-70">
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Logging in...
            </>
          ) : (
            <>
              Log in <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {/*
        Company first: staff accounts come from their organisation's
        administrator; a company new to XwiftHQ starts at /get-started.
        Self-serve sign up stays reachable for an invitation link that carries
        a `redirect`.
      */}
      <div className="mt-8 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
        <p>No account yet? Your company admin can add you.</p>
        <p className="mt-1">
          New to XwiftHQ?{" "}
          <Link
            href={requested ? `/register?redirect=${encodeURIComponent(requested)}` : "/get-started"}
            className="font-semibold text-primary-700 hover:text-primary-800"
          >
            {requested ? "Create an account" : "Set up your company"}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
