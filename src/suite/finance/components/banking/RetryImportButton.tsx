"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/workspace/kit";
import { ErrorNote } from "@/suite/lms/components/ui/ws";
import { banking, errorText, type StatementSummary } from "@/lib/api/finance-banking-client";
import { canRetryImport } from "./labels";

/**
 * "Run again" for a statement import that failed, or that has sat on the
 * queue too long: the stored file is read again, nothing needs uploading.
 * Renders nothing when the import can't be run again or the person may not
 * (`allowed`: `mayDo(user, "statements", "retry")`).
 */
export default function RetryImportButton({
  statement,
  allowed,
  onRetried,
  size = "sm",
  variant = "secondary",
}: {
  statement: Pick<StatementSummary, "id" | "status" | "uploadedAt">;
  allowed: boolean;
  onRetried: (s: StatementSummary) => void;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!allowed || !canRetryImport(statement)) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      onRetried(await banking.statements.retry(statement.id));
    } catch (e) {
      setError(`It didn't start again. ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col gap-2">
      <Button size={size} variant={variant} icon={RotateCw} onClick={run} disabled={busy}>
        {busy ? "Starting…" : "Run again"}
      </Button>
      {error && <ErrorNote>{error}</ErrorNote>}
    </span>
  );
}
