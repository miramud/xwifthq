"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chip } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import { ApiError, type CommissionStatus, type Earnings } from "@/lib/api/affiliate-client";

/*
  Pieces the affiliate's own pages share: what each commission status is
  called and coloured, the order currencies are shown in, the copy-to-
  clipboard state, and one plain sentence for "you are not an affiliate".
*/

/* ------------------------------------------------------------------ */
/*  Commission status                                                  */
/* ------------------------------------------------------------------ */

/** The affiliate's words for each status, in the order money moves through them. */
export const COMMISSION_STATUS: { key: CommissionStatus; label: string; hue: Hue }[] = [
  { key: "pending", label: "On hold", hue: "sun" },
  { key: "approved", label: "Ready to pay", hue: "mint" },
  { key: "paid", label: "Paid", hue: "blue" },
  { key: "reversed", label: "Reversed", hue: "slate" },
];

const STATUS_BY_KEY = new Map(COMMISSION_STATUS.map((s) => [s.key, s]));

/** A commission's status as a chip; an unknown status from a newer API shows its own label. */
export function CommissionChip({ status, label }: { status: string; label?: string }) {
  const known = STATUS_BY_KEY.get(status as CommissionStatus);
  return (
    <Chip hue={known?.hue ?? "slate"} dot>
      {known?.label ?? label ?? status}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/*  Money                                                              */
/* ------------------------------------------------------------------ */

export type StatusTotals = Record<CommissionStatus, number>;

export const NO_EARNINGS: StatusTotals = { pending: 0, approved: 0, paid: 0, reversed: 0 };

/**
 * Naira first, because nearly everything is earned in it, then any other
 * currency the affiliate has actually earned in. Currencies are never added
 * together, so each one is shown on its own.
 */
export function currenciesOf(earnings: Earnings | null | undefined): string[] {
  const others = Object.keys(earnings ?? {})
    .filter((c) => c !== "NGN")
    .sort();
  return ["NGN", ...others];
}

export function totalsFor(earnings: Earnings | null | undefined, currency: string): StatusTotals {
  return { ...NO_EARNINGS, ...(earnings?.[currency] ?? {}) };
}

/** Everything earned that still stands: on hold, ready and paid, never reversed. */
export function earnedOf(t: StatusTotals): number {
  return t.pending + t.approved + t.paid;
}

/* ------------------------------------------------------------------ */
/*  Loading                                                            */
/* ------------------------------------------------------------------ */

export const NOT_AN_AFFILIATE =
  "Your account isn't an affiliate account any more, so there is nothing to show here. Apply on the affiliates page to join again.";

/**
 * The API answers 404 to somebody who is not an affiliate. The layout already
 * turns them away, but a session can go stale (an account closed while the
 * page is open), so that answer becomes a sentence rather than "Not found".
 */
export function explained<T>(request: Promise<T>): Promise<T> {
  return request.catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) throw new ApiError(NOT_AN_AFFILIATE, 404);
    throw e;
  });
}

/* ------------------------------------------------------------------ */
/*  Copying                                                            */
/* ------------------------------------------------------------------ */

/**
 * Copy text to the clipboard and remember which control did it for a few
 * seconds, so that control can say "Copied" and a live region can announce
 * it. A browser that refuses (no permission, not a secure page) is reported
 * rather than ignored, so nobody pastes a link they never copied.
 */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async (key: string, text: string) => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setCopied(key);
      timer.current = setTimeout(() => setCopied(null), 3000);
    } catch {
      setCopied(null);
      setFailed(true);
    }
  }, []);

  return { copied, failed, copy };
}
