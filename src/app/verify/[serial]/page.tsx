import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, ArrowLeft } from "lucide-react";
import { getCertificate } from "@/lib/api/certificates-server";
import { Clouds } from "@/components/site/Sky";
import VerifiedResult from "@/suite/lms/components/certificate/VerifiedResult";

export const metadata: Metadata = {
  title: "Verify a certificate",
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
      <section className="xw-sky relative isolate overflow-hidden py-20 sm:py-28">
        <Clouds className="-z-10" />
        <div className="section-container flex min-h-[50vh] flex-col items-center justify-center text-center">
          <div className="xw-frame mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl!">
            <SearchX size={28} className="text-primary-600" aria-hidden="true" />
          </div>
          <h1 className="xw-h2">No certificate found</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600 sm:text-base">
            Nothing on our register matches the serial{" "}
            <span className="break-all font-semibold tracking-wide text-neutral-900">
              {decodeURIComponent(serial)}
            </span>
            . Check it for typos: serials follow the pattern{" "}
            <span className="font-medium text-neutral-700">TT-2026-AB12CD</span>.
          </p>
          <Link href="/verify" className="btn-primary mt-8">
            <ArrowLeft size={16} aria-hidden="true" />
            Try another serial
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-neutral-50">
      <VerifiedResult cert={cert} />
    </section>
  );
}
