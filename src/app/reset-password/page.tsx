"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound, Link2Off, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { AuthHeading, AuthShell } from "@/components/site/AuthShell";
import { useAuth } from "@/lib/auth-store";
import { landingFor } from "@/lib/roles";

type FieldErrors = { token?: string; password?: string };

/**
 * Choosing a new password from an emailed reset link.
 *
 * The link carries `token` and `email`. On success the page signs straight in
 * with the new password (asking somebody who has just proved they own the
 * inbox to type it again would only be friction) and sends them where their
 * kind of account lands. If that sign-in fails for any reason, the reset still
 * worked, and the page says so with a link to sign in.
 *
 * An expired or already-used link is the common failure, so it gets its own
 * state with a one-click way to ask for a fresh one, rather than an error line
 * under a form that can never succeed.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();

  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Choose a new password | XwiftHQ";
  }, []);

  const requestAgainHref = `/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setError(null);
    setFieldErrors({});

    if (password.length < 8) {
      setFieldErrors({ password: "Use at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      setFieldErrors({ password: "The two passwords do not match." });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, token, password, password_confirmation: confirm }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (!res.ok) {
        const tokenError = body.errors?.token?.[0] ?? body.errors?.email?.[0];
        const passwordError = body.errors?.password?.[0];

        if (tokenError) setFieldErrors({ token: tokenError });
        else if (passwordError) setFieldErrors({ password: passwordError });
        else setError(body.message ?? "We couldn't reset your password. Try again.");
        return;
      }

      // The reset worked. Sign in with the new password; if that fails, the
      // success state below still offers a way in.
      try {
        const signedIn = await login(email, password);
        const landing = landingFor(signedIn);
        router.replace(
          signedIn.mustChangePassword ? `/set-password?redirect=${encodeURIComponent(landing)}` : landing,
        );
      } catch {
        setDone(true);
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  // AUTH_INPUT's look, with room on the right for the show/hide toggle.
  const inputClass =
    "h-12 w-full rounded-xl border border-neutral-200 bg-white pl-11 pr-12 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100";

  let content: React.ReactNode;

  if (token === "" || email === "") {
    content = (
      <StateCard
        icon={<Link2Off className="h-6 w-6 text-neutral-500" aria-hidden="true" />}
        tone="neutral"
        title="This link is incomplete"
        body="Open the full link from your reset email, or ask us for a fresh one."
        action={{ href: requestAgainHref, label: "Request a new link" }}
      />
    );
  } else if (fieldErrors.token) {
    content = (
      <StateCard
        icon={<Link2Off className="h-6 w-6 text-error-600" aria-hidden="true" />}
        tone="error"
        title="This link is invalid or has expired"
        body="Each reset link works once and only for 60 minutes. Request another and open the newest email."
        action={{ href: requestAgainHref, label: "Request a new link" }}
      />
    );
  } else if (done) {
    content = (
      <StateCard
        icon={<CheckCircle2 className="h-6 w-6 text-success-600" aria-hidden="true" />}
        tone="success"
        title="Your password has been changed"
        body="All set. Sign in with the password you just chose."
        action={{ href: `/login?email=${encodeURIComponent(email)}`, label: "Sign in" }}
      />
    );
  } else {
    content = (
      <>
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 ring-1 ring-primary-100">
          <KeyRound className="h-6 w-6 text-primary-600" aria-hidden="true" />
        </div>
        <AuthHeading
          title="Choose a new password"
          intro={
            <>
              For <span className="break-all font-medium text-neutral-800">{email}</span>. We&apos;ll sign you in as
              soon as it&apos;s saved.
            </>
          }
        />

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-error-500/20 bg-error-500/10 px-4 py-3 text-sm text-error-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-800">
              New password
            </label>
            <div className="relative">
              <KeyRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                autoFocus
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide passwords" : "Show passwords"}
                aria-pressed={show}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
            {fieldErrors.password ? (
              <p id="password-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-error-700">
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {fieldErrors.password}
              </p>
            ) : (
              <p id="password-hint" className="mt-1.5 text-xs text-neutral-500">
                At least 8 characters.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-neutral-800">
              Confirm new password
            </label>
            <div className="relative">
              <KeyRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                id="confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            className="btn-primary h-12 w-full disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <ShieldCheck size={16} aria-hidden="true" />
            )}
            {saving ? "Saving…" : "Save password and sign in"}
          </button>
        </form>
      </>
    );
  }

  return (
    <AuthShell>
      {content}
      <p className="mt-8 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
        Remembered it after all?{" "}
        <Link
          href="/login"
          className="rounded font-semibold text-primary-700 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function StateCard({
  icon,
  tone,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  tone: "neutral" | "error" | "success";
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  const tile = {
    neutral: "bg-neutral-100 ring-neutral-200",
    error: "bg-error-500/10 ring-error-500/20",
    success: "bg-success-50 ring-success-200",
  }[tone];

  return (
    <div role={tone === "error" ? "alert" : "status"}>
      <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${tile}`}>{icon}</div>
      <h1 className="font-heading text-[2rem] font-bold leading-tight tracking-[-0.03em] text-neutral-900">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
      <Link href={action.href} className="btn-primary mt-7 h-12 w-full">
        {action.label}
      </Link>
    </div>
  );
}

/** `useSearchParams` suspends, so the form sits behind a boundary. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
