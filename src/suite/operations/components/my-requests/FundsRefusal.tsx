"use client";

import { useId, useState } from "react";
import { AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/workspace/kit";
import { textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import type { FundsCode } from "@/lib/api/operations-procurement-client";

/**
 * When the project can't fund a request: what the API said, and - for the MD
 * or a delegate, who may send it anyway - a reason box and a button that
 * sends it beyond the funds. Everybody else is told who to ask.
 */
export default function FundsRefusal({
  code,
  message,
  canOverride,
  busy,
  onOverride,
}: {
  code: FundsCode;
  message: string;
  canOverride: boolean;
  busy: boolean;
  onOverride: (reason: string) => void;
}) {
  const uid = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  return (
    <div role="alert" className="rounded-2xl bg-sun-50 p-4 ring-1 ring-sun-500/30">
      <p className="flex items-start gap-2 text-sm font-semibold text-sun-700">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        {code === "NO_FUNDS_RELEASED" ? "No funds released to this project yet" : "More than the project has available"}
      </p>
      <p className="mt-1 text-sm text-sun-700">{message}</p>
      {canOverride ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`${uid}-r`} className="block text-sm font-medium text-neutral-800">
            Your reason for sending it beyond the funds
          </label>
          <textarea
            id={`${uid}-r`}
            rows={2}
            className={textareaClass}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(undefined);
            }}
            placeholder="Why this should go ahead before more funds are released"
            aria-describedby={error ? `${uid}-e` : undefined}
          />
          <FieldError id={`${uid}-e`} message={error} />
          <div className="flex justify-end">
            <Button
              variant="primary"
              icon={Send}
              disabled={busy}
              onClick={() => {
                if (!reason.trim()) {
                  setError("Give the reason; approvers see it beside the funds position.");
                  return;
                }
                onOverride(reason.trim());
              }}
            >
              {busy ? "Sending…" : "Send beyond the funds"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-700">It is saved as a draft. Ask Finance for a release, or ask the MD, who can send it beyond the funds with a reason.</p>
      )}
    </div>
  );
}
