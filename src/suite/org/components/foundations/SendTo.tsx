"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, UserRound } from "lucide-react";
import { orgFoundations, type ContactCard } from "@/lib/api/org-foundations-client";
import { cx } from "@/components/workspace/kit";

/**
 * "Send to": the main contact at a client or vendor, read-only, for the
 * invoice, the purchase order and the client page. Read through the
 * organisation lookup, which anybody in the organisation may call; the
 * contacts are kept on the counterparty in the organisation console.
 *
 * Quiet by design: nothing while loading, nothing if the lookup fails, and a
 * one-line hint when there is no main contact.
 */
export default function SendTo({ counterpartyId, label = "Send to", className }: { counterpartyId: string | null | undefined; label?: string; className?: string }) {
  const [contact, setContact] = useState<ContactCard | null | undefined>(undefined);

  useEffect(() => {
    if (!counterpartyId) return;
    let alive = true;
    orgFoundations.lookups.counterpartyContacts(counterpartyId).then(
      (rows) => alive && setContact(rows.find((c) => c.isPrimary) ?? null),
      () => alive && setContact(undefined),
    );
    return () => {
      alive = false;
    };
  }, [counterpartyId]);

  if (!counterpartyId || contact === undefined) return null;

  if (contact === null) {
    return <p className={cx("text-xs text-neutral-500", className)}>{label}: no main contact on file yet.</p>;
  }

  return (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600", className)} aria-label={`${label}: ${contact.name}`}>
      <span className="inline-flex items-center gap-1.5">
        <UserRound size={14} className="text-neutral-400" aria-hidden />
        <span className="text-neutral-500">{label}</span>
        <span className="font-semibold text-neutral-800">{contact.name}</span>
        {contact.jobTitle && <span className="text-neutral-500">· {contact.jobTitle}</span>}
      </span>
      {contact.email && (
        <a href={`mailto:${contact.email}`} className="inline-flex min-w-0 items-center gap-1.5 rounded hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
          <Mail size={13} className="text-neutral-400" aria-hidden />
          <span className="truncate">{contact.email}</span>
        </a>
      )}
      {contact.phone && (
        <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 rounded tabular-nums hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
          <Phone size={13} className="text-neutral-400" aria-hidden />
          {contact.phone}
        </a>
      )}
    </div>
  );
}
