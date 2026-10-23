import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, ArrowLeft } from "lucide-react";
import { getCertificate } from "@/lib/api/certificates-server";
import VerifiedResult from "@/suite/lms/components/certificate/VerifiedResult";

export const metadata: Metadata = {
  title: "Verify Certificate | Elevate",
  robots: { index: false, follow: false },
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;
  const cert = await getCertificate(serial);

  if (!cert) {
    return (
      <section className="section-container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
          <SearchX size={30} className="text-neutral-400" />
        </div>
        <h1
          className="heading-3 text-neutral-900"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          No certificate found
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
          We couldn&apos;t find a certificate with the serial{" "}
          <span className="font-semibold tracking-wide text-neutral-700">
            {decodeURIComponent(serial)}
          </span>
          . Check for typos — serials look like{" "}
          <span className="font-medium text-neutral-600">TT-2026-AB12CD</span>.
        </p>
        <Link
          href="/verify"
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          <ArrowLeft size={16} />
          Try another serial
        </Link>
      </section>
    );
  }

  return (
    <section className="bg-neutral-50">
      <VerifiedResult cert={cert} />
    </section>
  );
}
