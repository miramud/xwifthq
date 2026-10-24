"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Check, Clock, Loader2, Receipt, RotateCcw, type LucideIcon } from "lucide-react";
import { ButtonLink, Card, PageHeader, cx, orbClass } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { useAuth } from "@/lib/auth-store";
import { formatDate } from "@/lib/console-data";
import { ApiError, billing, purchaseAmount, type Purchase } from "@/lib/api/billing-client";

/**
 * Where the gateway sends an admin back to after paying for modules.
 *
 * Paystack returns `reference` (and `trxref`); Flutterwave returns `tx_ref`,
 * `status` and `transaction_id`. Whatever the gateway claims in the URL is
 * only a hint, the API re-verifies with the gateway before switching
 * anything on. Confirming here is a convenience, not the mechanism: the
 * webhook fulfils the payment whether or not this page is ever opened, and
 * both paths are idempotent. So "still clearing" is a calm, real outcome.
 *
 * Once a payment is confirmed the session is refreshed, so the sidebar, the
 * Suites menu and the module guards see the new modules without a reload.
 */

type Outcome =
  | { kind: "checking" }
  | { kind: "paid"; purchase: Purchase }
  | { kind: "pending"; purchase: Purchase | null; final: boolean }
  | { kind: "failed"; message: string; cancelled: boolean };

export const POLL_ATTEMPTS = 5;

export function BillingReturn({
  reference,
  gatewayStatus,
  pollMs = 3000,
}: {
  reference: string;
  /** Flutterwave's `status` query param, e.g. "cancelled". A hint only. */
  gatewayStatus?: string | null;
  pollMs?: number;
}) {
  const { refresh } = useAuth();
  const [checked, setChecked] = useState<Outcome | null>(null);

  const outcome: Outcome =
    reference === ""
      ? { kind: "failed", message: "That link is missing its payment reference.", cancelled: false }
      : (checked ?? { kind: "checking" });

  useEffect(() => {
    if (reference === "") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = (attempt: number) => {
      billing
        .verify(reference)
        .then((purchase) => {
          if (!alive) return;
          if (purchase.status === "paid") {
            setChecked({ kind: "paid", purchase });
            void refresh?.();
            return;
          }
          if (purchase.status === "pending") {
            const final = attempt + 1 >= POLL_ATTEMPTS;
            setChecked({ kind: "pending", purchase, final });
            if (!final) timer = setTimeout(() => check(attempt + 1), pollMs);
            return;
          }
          const cancelled = purchase.status === "cancelled" || purchase.status === "abandoned" || gatewayStatus === "cancelled";
          setChecked({
            kind: "failed",
            cancelled,
            message: cancelled
              ? "The payment was cancelled before it went through. Nothing was charged."
              : "The gateway declined that payment. Nothing was switched on.",
          });
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setChecked({
            kind: "failed",
            cancelled: false,
            message: e instanceof ApiError ? e.message : "We couldn't confirm that payment.",
          });
        });
    };

    check(0);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // `refresh` is stable per session; re-running on it would re-verify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, gatewayStatus, pollMs]);

  const { icon: Icon, hue } = LOOK[outcome.kind];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Plan & billing" title="Module payment" subtitle="Confirming with the payment gateway." />
      <Card className="overflow-hidden">
        <div className={cx("h-1.5", HUE[hue].bar)} aria-hidden />
        <div className="flex flex-col items-center px-6 py-10 text-center sm:px-10" aria-live="polite">
          <span className={cx("flex h-16 w-16 items-center justify-center rounded-full", orbClass(hue))}>
            <Icon
              size={28}
              className={outcome.kind === "checking" ? "animate-spin motion-reduce:animate-none" : undefined}
              aria-hidden
            />
          </span>
          <h2 className="mt-5 text-xl font-bold tracking-tight text-neutral-900">{titleFor(outcome)}</h2>

          <div className="mt-3 w-full max-w-md">
            {outcome.kind === "checking" && (
              <p className="text-sm text-neutral-500">Checking with the payment gateway…</p>
            )}

            {outcome.kind === "paid" && (
              <>
                <p className="text-sm text-neutral-600">
                  {purchaseAmount(outcome.purchase)} received, once. These are your organisation&apos;s for good:
                </p>
                <ul className="mt-5 divide-y divide-neutral-100 rounded-2xl border border-neutral-100 bg-white text-left shadow-sm">
                  {outcome.purchase.modules.map((m) => (
                    <li key={m.key} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint-50 text-mint-700"><Check size={14} aria-hidden /></span>
                        {m.label}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {m.deliveredWhenReleased
                          ? "Switches on when released"
                          : m.endsOn
                            ? `Active until ${formatDate(m.endsOn)}`
                            : "Active now"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {outcome.kind === "pending" && (
              <>
                <p className="text-sm text-neutral-600">
                  {outcome.final
                    ? "The gateway hasn't confirmed it yet."
                    : "The gateway is still confirming it. This usually takes a few seconds."}
                </p>
                {outcome.final && (
                  <p className="mt-3 text-sm text-neutral-500">
                    Nothing is lost. We switch your modules on and email you as soon as it clears.
                  </p>
                )}
              </>
            )}

            {outcome.kind === "failed" && (
              <p className={cx("text-sm", outcome.cancelled ? "text-neutral-600" : "text-error-700")}>{outcome.message}</p>
            )}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {outcome.kind === "paid" && (
              <>
                <ButtonLink href={`/suite/org/billing/receipts/${encodeURIComponent(outcome.purchase.id)}`} variant="secondary">
                  <Receipt size={16} aria-hidden />
                  View receipt
                </ButtonLink>
                <ButtonLink href="/suite" variant="primary">
                  Go to the suite
                  <ArrowRight size={16} aria-hidden />
                </ButtonLink>
              </>
            )}
            {outcome.kind === "failed" && (
              <ButtonLink href="/suite/org/billing" variant="primary">
                <RotateCcw size={16} aria-hidden />
                Try again
              </ButtonLink>
            )}
            {(outcome.kind === "pending" || outcome.kind === "checking") && (
              <ButtonLink href="/suite/org/billing" variant="secondary">
                Back to Plan &amp; billing
              </ButtonLink>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function titleFor(o: Outcome): string {
  switch (o.kind) {
    case "checking":
      return "Confirming your payment";
    case "paid":
      return "Payment received";
    case "pending":
      return o.final ? "Payment still clearing" : "Almost there";
    case "failed":
      return o.cancelled ? "Payment cancelled" : "Payment didn't go through";
  }
}

const LOOK: Record<Outcome["kind"], { icon: LucideIcon; hue: Hue }> = {
  checking: { icon: Loader2, hue: "blue" },
  paid: { icon: Check, hue: "mint" },
  pending: { icon: Clock, hue: "sun" },
  failed: { icon: AlertCircle, hue: "rose" },
};
