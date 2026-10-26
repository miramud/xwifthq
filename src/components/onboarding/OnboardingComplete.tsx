"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Loader2, Mail, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { landingFor } from "@/lib/roles";
import { clearReferralCode } from "@/lib/referral";
import {
  CLAIM_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
  PublicApiError,
  onboarding,
  type VerifyResult,
} from "@/lib/api/public-pricing";

const POLL_LIMIT = 5;
const POLL_EVERY_MS = 3000;

function readClaim(reference: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(CLAIM_STORAGE_KEY);
    if (!raw) return null;
    const claim = JSON.parse(raw) as { reference?: string; claimToken?: string };
    // Only the token issued for *this* checkout; a stale one from an earlier try is useless.
    return claim.reference === reference && typeof claim.claimToken === "string" ? claim.claimToken : null;
  } catch {
    return null;
  }
}

function retryHref(): string {
  try {
    const raw = window.sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as { modules?: string[]; currency?: string }) : null;
    if (stored?.modules?.length) {
      return `/get-started?step=3&modules=${stored.modules.join(",")}&currency=${stored.currency ?? "NGN"}`;
    }
  } catch {
    /* fall through */
  }
  return "/get-started";
}

type View =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "result"; result: VerifyResult; gaveUp: boolean };

/**
 * Where the payment gateway sends the buyer back.
 *
 * Confirms the payment with the API (never with the gateway's query string),
 * and, when this browser holds the claim token from checkout, the proxy signs
 * the new XwiftHQ admin in, so the next thing they do is set their own password.
 * A payment still clearing is checked a few more times before the page says
 * the email will follow.
 */
export function OnboardingComplete() {
  const params = useSearchParams();
  const { refresh, user } = useAuth();
  const reference = params.get("reference") ?? params.get("tx_ref") ?? params.get("trxref");
  const [view, setView] = useState<View>(reference ? { kind: "checking" } : { kind: "missing" });
  // `refresh` changes identity when the session changes; the loop below must
  // not restart because of it, so it reads the latest one through a ref.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // Once per reference: verify, keep checking a clearing payment a few times,
  // then settle on what the API says.
  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    const claimToken = readClaim(reference);

    const run = async () => {
      try {
        const result = await onboarding.verify(reference, claimToken);
        if (cancelled) return;
        attempts += 1;

        if (result.status === "pending" && attempts < POLL_LIMIT) {
          setView({ kind: "result", result, gaveUp: false });
          timer = window.setTimeout(run, POLL_EVERY_MS);
          return;
        }

        if (result.status === "paid") {
          try {
            window.sessionStorage.removeItem(CLAIM_STORAGE_KEY);
            window.sessionStorage.removeItem(ONBOARDING_STORAGE_KEY);
          } catch {
            /* nothing to clear */
          }
          // The referral has done its job: the organisation is set up and credited.
          clearReferralCode();
          if (result.signedIn) await refreshRef.current();
          if (cancelled) return;
        }

        setView({ kind: "result", result, gaveUp: result.status === "pending" });
      } catch (error) {
        if (cancelled) return;
        setView({
          kind: "error",
          message:
            error instanceof PublicApiError && error.status === 404
              ? "We couldn't find that payment. If you were charged, contact us with your payment reference."
              : "We couldn't confirm the payment just now. Refresh this page in a moment.",
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [reference]);

  return (
    <div className="xw-frame mx-auto max-w-xl px-5 py-8 sm:p-10" aria-live="polite">
      {view.kind === "checking" && (
        <div className="py-8 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-600 motion-reduce:animate-none" aria-hidden="true" />
          <p className="mt-4 font-medium text-neutral-800">Confirming your payment…</p>
        </div>
      )}

      {view.kind === "missing" && (
        <Status icon={XCircle} tone="error" title="This link is missing its payment reference">
          <p>Head back to the start, or sign in if your organisation is already on XwiftHQ.</p>
          <Actions primary={{ href: "/get-started", label: "Start again" }} secondary={{ href: "/login", label: "Sign in" }} />
        </Status>
      )}

      {view.kind === "error" && (
        <Status icon={XCircle} tone="error" title="We couldn't confirm your payment">
          <p>{view.message}</p>
          {reference && <p className="mt-2 font-mono text-xs text-neutral-500">Reference: {reference}</p>}
        </Status>
      )}

      {view.kind === "result" && view.result.status === "paid" && (
        <Status icon={CheckCircle2} tone="success" title={`${view.result.organisation?.name ?? "Your organisation"} is ready`}>
          <p>Payment confirmed. Here is what you now own:</p>
          <ul className="mt-4 space-y-2 text-left">
            {view.result.modules.map((m) => (
              <li key={m.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-neutral-50 px-4 py-3 text-sm">
                <span className="font-medium text-neutral-800">{m.label}</span>
                <span className="text-xs text-neutral-500">{m.deliveredWhenReleased ? "Delivered when released" : "Active now"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-start justify-center gap-2 text-left text-sm">
            <Mail size={16} className="mt-0.5 shrink-0 text-primary-600" aria-hidden="true" />
            <span className="min-w-0 break-words">
              Your sign-in details and receipt are on their way to <strong className="text-neutral-900">{view.result.email}</strong>.
            </span>
          </p>
          {view.result.signedIn ? (
            <Actions
              primary={{
                href: `/set-password?redirect=${encodeURIComponent(user ? landingFor(user) : "/suite")}`,
                label: "Set your password",
              }}
            />
          ) : (
            <Actions primary={{ href: `/login?email=${encodeURIComponent(view.result.email)}`, label: "Sign in" }} />
          )}
        </Status>
      )}

      {view.kind === "result" && view.result.status === "pending" && (
        <Status icon={Clock} tone="neutral" title={view.gaveUp ? "Your payment is still clearing" : "Waiting for your payment to clear…"}>
          {view.gaveUp ? (
            <p>
              Some payments need a few minutes. The moment yours clears we&apos;ll set up your organisation and send
              sign-in details to {view.result.email}. It&apos;s safe to close this page.
            </p>
          ) : (
            <p>This normally takes a few seconds.</p>
          )}
        </Status>
      )}

      {view.kind === "result" && (view.result.status === "failed" || view.result.status === "abandoned") && (
        <Status icon={XCircle} tone="error" title="Your payment didn't go through">
          <p>
            {view.result.status === "abandoned"
              ? "The checkout was closed before paying. Nothing was charged."
              : "The payment was declined or cancelled. Nothing was charged."}{" "}
            Your details are saved, so you can try again.
          </p>
          <Actions primary={{ href: retryHref(), label: "Try again" }} secondary={{ href: "/pricing", label: "Back to pricing" }} />
        </Status>
      )}
    </div>
  );
}

function Status({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof CheckCircle2;
  tone: "success" | "error" | "neutral";
  title: string;
  children: React.ReactNode;
}) {
  const tile =
    tone === "success"
      ? "bg-primary-50 text-primary-600"
      : tone === "error"
        ? "bg-error-500/10 text-error-600"
        : "bg-accent-500/15 text-accent-700";
  return (
    <div className="text-center">
      <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${tile}`}>
        <Icon className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-heading text-2xl font-bold tracking-[-0.02em] text-neutral-900 sm:text-[1.75rem]">{title}</h2>
      <div className="mt-3 leading-relaxed text-neutral-600">{children}</div>
    </div>
  );
}

function Actions({ primary, secondary }: { primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  return (
    <div className="mt-7 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
      {secondary && (
        <Link href={secondary.href} className="btn-outline min-h-11">
          {secondary.label}
        </Link>
      )}
      <Link href={primary.href} className="btn-primary min-h-11">
        {primary.label}
      </Link>
    </div>
  );
}
