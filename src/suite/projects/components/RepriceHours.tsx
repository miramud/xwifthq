"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ApiError, time as timeApi } from "@/lib/api/projects-client";
import { hours, money } from "./money";

/**
 * "Reprice zero-cost hours" (D21).
 *
 * Hours logged before any rate existed were costed at zero, on purpose: a
 * rate is snapshotted when the hour is logged, and nobody had chosen one.
 * This is the audited way to fill that gap once the rates are set, never a
 * silent restatement, so it always previews first ("6 h across 3 entries
 * would cost ₦180,000") and asks before writing anything.
 *
 * Only offered to somebody who manages rates (`can.manageRates`); the server
 * refuses everybody else. Reports what happened inline, beside the button,
 * because the figures around it change as a result.
 */
export default function RepriceHours({ slug, onRepriced }: { slug: string; onRepriced: () => void }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "note" | "error"; text: string } | null>(null);

  const start = async () => {
    setBusy(true);
    setMessage(null);

    try {
      const preview = await timeApi.repricePreview(slug);

      if (preview.logs === 0) {
        setMessage({
          tone: "note",
          text:
            preview.unpriceable > 0
              ? `Nothing can be priced yet: ${hours(preview.unpriceableHours)} still have no rate (or need an exchange rate). Set one on Rates first.`
              : "There are no zero-cost hours to reprice.",
        });
        return;
      }

      const ok = await confirm({
        title: "Reprice zero-cost hours?",
        body: (
          <>
            <span className="block">
              {hours(preview.hours)} across {preview.logs} {preview.logs === 1 ? "entry" : "entries"} will be priced
              at today&apos;s rates, adding{" "}
              <span className="font-semibold tabular-nums">{money(preview.costMinor, preview.currency)}</span> to
              this project&apos;s cost.
            </span>
            {preview.unpriceable > 0 && (
              <span className="mt-2 block">
                {hours(preview.unpriceableHours)} still have no rate and stay at zero.
              </span>
            )}
            <span className="mt-2 block">Hours that already had a rate are not touched. This is recorded in the audit log.</span>
          </>
        ),
        confirmLabel: "Reprice hours",
        tone: "primary",
      });

      if (!ok) return;

      const done = await timeApi.reprice(slug);

      setMessage({
        tone: "ok",
        text: `Repriced ${hours(done.hours)}: ${money(done.costMinor, done.currency)} added to the cost.`,
      });
      onRepriced();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ApiError ? e.message : "That did not go through." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" icon={RefreshCcw} disabled={busy} onClick={() => void start()}>
        {busy ? "Checking…" : "Reprice zero-cost hours"}
      </Button>
      {message !== null && (
        <span
          role={message.tone === "error" ? "alert" : "status"}
          className={
            message.tone === "error"
              ? "text-xs font-semibold text-error-700"
              : message.tone === "ok"
                ? "text-xs font-semibold text-mint-700"
                : "text-xs text-neutral-700"
          }
        >
          {message.text}
        </span>
      )}
    </span>
  );
}
