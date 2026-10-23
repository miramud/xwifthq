"use client";

import { useState } from "react";
import { SalesRequestDialog } from "./SalesRequestDialog";

/**
 * The footer's "Enterprise enquiry" link. The footer is a server component,
 * so the one interactive piece in it lives here.
 */
export function EnterpriseEnquiryButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`text-left ${className}`}>
        Enterprise enquiry
      </button>
      <SalesRequestDialog type="enterprise" open={open} onClose={() => setOpen(false)} />
    </>
  );
}
