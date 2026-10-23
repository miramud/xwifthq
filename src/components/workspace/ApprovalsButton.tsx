"use client";

import Link from "next/link";
import { Stamp } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useApprovalCounts } from "@/suite/approvals/lib/useApprovalCounts";
import { cx } from "./kit";

/**
 * The top bar's way into the approvals inbox, beside the bell: a stamp with
 * the number of requests waiting on you. Hidden for anybody outside an
 * organisation (the platform owner has no inbox). The count is polled once a
 * minute and fails silently.
 */
export function ApprovalsButton() {
  const { user } = useAuth();
  const inOrg = Boolean(user?.organisationId);
  const counts = useApprovalCounts(inOrg);

  if (!inOrg) return null;

  const waiting = counts?.to_approve ?? 0;
  const label = waiting > 0 ? `Approvals, ${waiting} waiting` : "Approvals";

  return (
    <Link
      href="/suite/approvals"
      aria-label={label}
      title={label}
      data-tour="approvals"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 outline-none transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <Stamp size={18} aria-hidden />
      {waiting > 0 && (
        <span
          aria-hidden
          className={cx(
            "absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white",
          )}
        >
          {waiting > 99 ? "99+" : waiting}
        </span>
      )}
    </Link>
  );
}
