/* Shared certificate types + helpers (used by verify pages and learner views). */

export interface CertificateTemplateBrand {
  orgName: string;
  signatoryName: string;
  signatoryTitle: string;
  accentColor: string;
  logoUrl: string | null;
}

export interface CertificateData {
  serial: string;
  recipientName: string;
  courseTitle: string;
  instructorName: string | null;
  issuedAt: string | null;
  /**
      Expired and revoked are separate facts and the UI must never merge them.
      Revoked means the institution took it back. Expired means it was earned
      properly and has run its term — the holder did nothing wrong.
   */
  expiresAt: string | null;
  expires: boolean;
  expired: boolean;
  /** Signed: negative once it has lapsed. */
  daysUntilExpiry: number | null;
  /** Neither revoked nor expired. */
  valid: boolean;
  /** Which round of recurring training this one is. 1 unless renewed. */
  cycle: number;
  revoked: boolean;
  revokedAt: string | null;
  courseSlug?: string | null;
  verifyUrl: string | null;
  template: CertificateTemplateBrand;
}

export function formatIssuedDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
