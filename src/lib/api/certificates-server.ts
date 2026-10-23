/* Server-only helper for the public certificate verification endpoint. */

import "server-only";
import type { CertificateData } from "@/suite/lms/lib/certificate";

const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

/**
 * Look up a certificate by serial. Returns null for an unknown serial.
 * Never ISR-cached: a freshly revoked certificate must verify as revoked
 * immediately, so this is always a live read.
 */
export async function getCertificate(
  serial: string,
): Promise<CertificateData | null> {
  try {
    const res = await fetch(
      `${API_URL}/certificates/${encodeURIComponent(serial)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: CertificateData };
    return body.data ?? null;
  } catch {
    return null;
  }
}
