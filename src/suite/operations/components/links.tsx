"use client";

import Link from "next/link";
import { useAuth, type AuthUser } from "@/lib/auth-store";
import { mayOpenOrgPage } from "@/lib/org-access";
import { mayUseFinance } from "@/suite/finance/lib/finance-access";

/*
  Links out of Operations to the record behind a name: a vendor to its page in
  the organisation console, a memo to Finance's memo page (or the Core memo
  page for somebody without Finance). Only offered where the person may open
  the page; otherwise the name stays plain text.
*/

const LINK = "font-semibold text-primary-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded";

/** May this person open the clients-and-vendors page of the organisation console? */
export function mayOpenCounterparties(user: AuthUser | null): boolean {
  return Boolean(user?.organisationId) && mayOpenOrgPage(user, "/suite/org/counterparties");
}

/** Where a memo opens for this person. */
export function memoHref(user: AuthUser | null, memoId: string): string {
  return mayUseFinance(user, "memos") ? `/suite/finance/memos/${memoId}` : `/suite/memos/${memoId}`;
}

/** A vendor or client name, linked to its counterparty page when there is an id and the person may open it. */
export function CounterpartyLink({ id, name, fallback = "-", className }: { id?: string | null; name?: string | null; fallback?: React.ReactNode; className?: string }) {
  const { user } = useAuth();
  if (!name) return <>{fallback}</>;
  if (!id || !mayOpenCounterparties(user)) return <>{name}</>;
  return (
    <Link href={`/suite/org/counterparties/${id}`} className={className ?? LINK}>
      {name}
    </Link>
  );
}

/** A memo reference, linked to the memo when its id is known. */
export function MemoLink({ id, reference, className }: { id?: string | null; reference?: string | null; className?: string }) {
  const { user } = useAuth();
  const text = reference ?? (id ? "Raised" : "-");
  if (!id) return <>{text}</>;
  return (
    <Link href={memoHref(user, id)} className={className ?? LINK}>
      {text}
    </Link>
  );
}
