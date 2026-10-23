"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, LogIn } from "lucide-react";
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
    document.title = "Log In | Elevate";
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
    <section className="bg-neutral-50 min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
          <h1
            className="heading-4 text-neutral-900 mb-1"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Welcome back
          </h1>
          <p className="text-sm text-neutral-500 mb-6">
            Sign in to your organisation&apos;s Elevate workspace — finance,
            operations, people, projects and training in one place.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-error-50 border border-error-200 px-4 py-3 text-sm text-error-600">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Work email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                  Password
                </label>
                {/* Carries whatever has been typed so the next page needn't ask again. */}
                <Link
                  href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
                  className="rounded text-xs font-semibold text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 text-sm font-semibold gap-2 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Logging in...
                </>
              ) : (
                <>
                  <LogIn size={16} /> Log In
                </>
              )}
            </button>
          </form>

          {/*
            Company first (owner, 9 Oct 2026): staff accounts come from their
            organisation's administrator; a company new to Elevate starts at
            /get-started. Self-serve sign-up stays reachable for an invitation
            link that carries a `redirect`.
          */}
          <p className="text-sm text-neutral-500 text-center mt-6">
            No account yet? Your organisation&apos;s administrator adds you.
            <br />
            New to Elevate?{" "}
            <Link
              href={requested ? `/register?redirect=${encodeURIComponent(requested)}` : "/get-started"}
              className="font-semibold text-primary-600 hover:text-primary-700"
            >
              {requested ? "Create an account" : "Set up your company"}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
