/* Server-only helper for the public document verification endpoint. */

import "server-only";

const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

export interface VerifiedDecision {
  stage: string;
  by: string;
  /** approved | approved_with_amendment | recommended | rejected | returned */
  action: string;
  at: string;
}

/** What `GET /public/verify/{token}` returns. Never carries amounts. */
export interface VerifiedDocument {
  valid: boolean;
  revoked: { at: string; reason: string | null } | null;
  /** approval_record | memo | … */
  kind: string;
  title: string;
  reference: string | null;
  issuer: { name: string; legalName: string | null };
  issuedAt: string;
  issuedBy: string | null;
  sha256: string;
  bytes: number | null;
  current: {
    status: string;
    completedAt: string | null;
    decisions: VerifiedDecision[];
  } | null;
}

/**
 * Look up an issued document by its QR token. Null for an unknown token (the
 * API answers a plain 404) or when the API can't be reached. Always a live
 * read: a document revoked a minute ago must verify as revoked now.
 */
export async function getVerifiedDocument(token: string): Promise<VerifiedDocument | null> {
  if (!/^[A-Za-z0-9]{20,64}$/.test(token)) return null;
  try {
    const res = await fetch(`${API_URL}/public/verify/${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: VerifiedDocument };
    return body.data ?? null;
  } catch {
    return null;
  }
}
