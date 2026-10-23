"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, User, UserPlus } from "lucide-react";
import { AUTH_INPUT, AuthHeading, AuthShell } from "@/components/site/AuthShell";
import { useAuth, AuthError } from "@/lib/auth-store";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/my-courses";
  const { register, isAuthenticated, loading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Create account | XwiftHQ";
  }, []);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace(redirect);
  }, [loading, isAuthenticated, redirect, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name,
        email,
        password,
        password_confirmation: confirm,
      });
      router.replace(redirect);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Create your account"
        intro="Set up your XwiftHQ login in a few seconds, then head straight to what you were invited to."
      />

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-error-500/20 bg-error-500/10 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-neutral-800">
            Full Name
          </label>
          <div className="relative">
            <User size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className={AUTH_INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-800">
            Email Address
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
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-800">
            Password
          </label>
          <div className="relative">
            <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={AUTH_INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-neutral-800">
            Confirm Password
          </label>
          <div className="relative">
            <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it once more"
              className={AUTH_INPUT}
            />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary h-12 w-full disabled:opacity-70">
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Creating account...
            </>
          ) : (
            <>
              <UserPlus size={16} aria-hidden="true" /> Create Account
            </>
          )}
        </button>
      </form>

      <div className="mt-8 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
        Already have an account?{" "}
        <Link
          href={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
          className="rounded font-semibold text-primary-700 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          Log in
        </Link>
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
