"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarX,
  ShieldAlert,
  Copy,
  Check,
  Printer,
  Search,
} from "lucide-react";
import { type CertificateData, formatIssuedDate } from "@/suite/lms/lib/certificate";
import CertificateCard from "./CertificateCard";
import Confetti from "./Confetti";

/**
 * The verification outcome for a real certificate.
 *
 * Three verdicts, not two, and the middle one is the reason this was rewritten.
 * A revoked certificate was withdrawn by the institution — something went
 * wrong, and the red banner is right. An **expired** one was earned properly
 * and has simply run its term, which is the normal end of any annual
 * qualification. Showing that person the revocation banner would tell a
 * verifier their credential was taken off them.
 *
 * So expired gets its own amber verdict that says, in as many words, that the
 * credential is genuine and when it lapsed. No confetti — it is not a
 * celebration — but no accusation either.
 */
export default function VerifiedResult({ cert }: { cert: CertificateData }) {
  const [copied, setCopied] = useState(false);

  const copySerial = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cert.serial);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — no-op */
    }
  }, [cert.serial]);

  const revoked = cert.revoked;
  // Revocation outranks expiry: a certificate that was taken back is described
  // as taken back, whatever its dates would otherwise have said.
  const expired = !revoked && cert.expired;
  const valid = !revoked && !expired;

  return (
    <div className="relative">
      {valid && <Confetti />}

      <div className="section-container relative py-10 sm:py-14">
        {/* verdict banner */}
        <div className="mx-auto max-w-2xl text-center">
          {revoked ? (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error-50 ring-8 ring-error-50/50">
              <ShieldAlert size={30} className="text-error-600" />
            </div>
          ) : expired ? (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-50 ring-8 ring-warning-50/60">
              <CalendarX size={30} className="text-warning-600" />
            </div>
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 ring-8 ring-success-50/60">
              <BadgeCheck size={30} className="text-success-600" />
            </div>
          )}

          <h1
            className="heading-3 text-neutral-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {revoked
              ? "This certificate was revoked"
              : expired
                ? "This certificate has expired"
                : "Certificate verified"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
            {revoked ? (
              <>
                Serial <span className="font-semibold text-neutral-700">{cert.serial}</span> was
                issued by {cert.template.orgName} but has since been revoked
                {cert.revokedAt ? ` on ${formatIssuedDate(cert.revokedAt)}` : ""}. It is no longer valid.
              </>
            ) : expired ? (
              <>
                {/*
                  Said first and said plainly. Somebody checking this needs to
                  know the credential was real before they are told it lapsed.
                */}
                This is a genuine {cert.template.orgName} credential, issued to{" "}
                <span className="font-semibold text-neutral-700">{cert.recipientName}</span>
                {cert.expiresAt ? <> and valid until {formatIssuedDate(cert.expiresAt)}</> : null}.
                It has since expired and would need renewing.
              </>
            ) : (
              <>
                This is a genuine {cert.template.orgName} credential, issued to{" "}
                <span className="font-semibold text-neutral-700">{cert.recipientName}</span> and
                recorded on our register.
                {cert.expiresAt ? (
                  <> It is valid until {formatIssuedDate(cert.expiresAt)}.</>
                ) : null}
              </>
            )}
          </p>
        </div>

        {/* the certificate */}
        <div className="mt-9">
          <div className={valid ? "" : "opacity-70 grayscale"}>
            <CertificateCard cert={cert} />
          </div>
        </div>

        {/* actions */}
        <div className="mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={copySerial}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
          >
            {copied ? <Check size={16} className="text-success-600" /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy serial"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
          >
            <Printer size={16} />
            Print / Save PDF
          </button>
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
          >
            <Search size={16} />
            Verify another
          </Link>
        </div>
      </div>
    </div>
  );
}
