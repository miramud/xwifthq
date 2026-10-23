"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Check, Clock, Loader2, type LucideIcon } from "lucide-react";
import { ButtonLink, Card, PageHeader, cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { seats as seatsApi, ApiError, type SeatSummary } from "@/lib/api/saas-client";

/**
 * Where the payment gateway (Paystack or Flutterwave, whichever the platform
 * owner has selected) sends an admin back to after paying for seats.
 *
 * Confirming here is a convenience, not the mechanism: the webhook credits the
 * seats whether or not this page is ever opened, and both paths are idempotent.
 * That is why "still processing" is a real, calm outcome rather than an error —
 * an admin who closed the tab has lost nothing.
 */

type Outcome =
  | { kind: "checking" }
  | { kind: "paid"; summary: SeatSummary }
  | { kind: "pending" }
  | { kind: "failed"; message: string };

function VerifyInner() {
  const params = useSearchParams();
  // Paystack returns `reference` (and `trxref`); Flutterwave returns `tx_ref`.
  const reference = params.get("reference") ?? params.get("trxref") ?? params.get("tx_ref") ?? "";

  /**
   * A missing reference is knowable at render time, so it is derived rather
   * than written in an effect — a synchronous setState there costs a cascading
   * render for something we already knew.
   */
  const [checked, setChecked] = useState<Outcome | null>(null);

  const outcome: Outcome =
    reference === ""
      ? { kind: "failed", message: "That link is missing its payment reference." }
      : (checked ?? { kind: "checking" });

  useEffect(() => {
    if (reference === "") return;

    let alive = true;

    seatsApi
      .verify(reference)
      .then(({ purchase, summary }) => {
        if (!alive) return;

        if (purchase.status === "paid") {
          setChecked({ kind: "paid", summary });
        } else if (purchase.status === "pending") {
          setChecked({ kind: "pending" });
        } else {
          setChecked({
            kind: "failed",
            message: purchase.note ?? "That payment did not go through.",
          });
        }
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setChecked({
          kind: "failed",
          message: e instanceof ApiError ? e.message : "We could not confirm that payment.",
        });
      });

    return () => {
      alive = false;
    };
  }, [reference]);

  const { icon: Icon, hue } = LOOK[outcome.kind];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Seats" title="Seat payment" subtitle="Confirming with the payment gateway." />

      <Card className="overflow-hidden">
        <div className={cx("h-1.5", HUE[hue].bar)} aria-hidden />
        <div className="flex flex-col items-center px-6 py-10 text-center sm:px-10">
          <span className={cx("flex h-16 w-16 items-center justify-center rounded-2xl", HUE[hue].soft)}>
            <Icon
              size={28}
              className={outcome.kind === "checking" ? "animate-spin" : undefined}
              aria-hidden
            />
          </span>
          <h2 className="mt-5 text-xl font-bold tracking-tight text-neutral-900">{TITLES[outcome.kind]}</h2>

          <div className="mt-3 max-w-md">
            {outcome.kind === "checking" && (
              <p className="text-sm text-neutral-500">Checking with the payment gateway…</p>
            )}

            {outcome.kind === "paid" && (
              <>
                <p className="text-sm font-medium text-mint-700">Your seats have been added.</p>
                <p className="mt-3 text-sm text-neutral-600">
                  Your institution now has{" "}
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {outcome.summary.seatLimit}
                  </span>{" "}
                  seats, {outcome.summary.seatsRemaining} of them free.
                </p>
              </>
            )}

            {outcome.kind === "pending" && (
              <>
                <p className="text-sm text-neutral-600">The gateway has not confirmed this one yet.</p>
                <p className="mt-3 text-sm text-neutral-500">
                  Nothing is lost. Payments are also confirmed automatically in the background — check
                  the Seats page again in a minute.
                </p>
              </>
            )}

            {outcome.kind === "failed" && <p className="text-sm text-error-700">{outcome.message}</p>}
          </div>

          <div className="mt-8">
            <ButtonLink href="/suite/org/seats" variant="primary">
              Back to seats
            </ButtonLink>
          </div>
        </div>
      </Card>
    </div>
  );
}

const LOOK: Record<Outcome["kind"], { icon: LucideIcon; hue: Hue }> = {
  checking: { icon: Loader2, hue: "blue" },
  paid: { icon: Check, hue: "mint" },
  pending: { icon: Clock, hue: "sun" },
  failed: { icon: AlertCircle, hue: "rose" },
};

const TITLES: Record<Outcome["kind"], string> = {
  checking: "Confirming your payment",
  paid: "Payment confirmed",
  pending: "Still processing",
  failed: "Payment not completed",
};

export default function SeatVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 py-20 text-sm text-neutral-500">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading…
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
