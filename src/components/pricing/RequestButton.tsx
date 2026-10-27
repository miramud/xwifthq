"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { SalesRequestDialog } from "./SalesRequestDialog";
import type { SalesRequestType } from "@/lib/api/public-pricing";

/**
 * A button that opens the request form, for the server-rendered parts of the
 * pricing page (offers, add-ons). `plan` and `copy` pass straight through.
 */
export function RequestButton({
  type = "enterprise",
  label,
  plan,
  copy,
  className = "btn-outline min-h-11",
}: {
  type?: SalesRequestType;
  label: string;
  plan?: string;
  copy?: React.ComponentProps<typeof SalesRequestDialog>["copy"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
        <ArrowRight size={16} aria-hidden="true" />
      </button>
      {open && <SalesRequestDialog type={type} open onClose={() => setOpen(false)} plan={plan} copy={copy} />}
    </>
  );
}
