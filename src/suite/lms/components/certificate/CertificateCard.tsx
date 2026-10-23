import { GraduationCap, ShieldCheck } from "lucide-react";
import { type CertificateData, formatIssuedDate } from "@/suite/lms/lib/certificate";

/**
 * The certificate credential itself — a print-friendly, landscape document.
 * Presentational only: pass it a resolved certificate. The template's accent
 * colour themes the frame, seal and rules via a CSS variable so one component
 * renders every brand.
 */
export default function CertificateCard({
  cert,
  className = "",
}: {
  cert: CertificateData;
  className?: string;
}) {
  const accent = cert.template.accentColor || "#9638cd";

  return (
    <div
      className={`certificate-card relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl shadow-neutral-900/10 ${className}`}
      style={{ ["--accent" as string]: accent }}
    >
      {/* accent top rule */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}99)` }}
      />

      {/* engraved inner border */}
      <div
        className="m-3 rounded-xl border p-6 sm:m-5 sm:p-10"
        style={{ borderColor: `${accent}33` }}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {cert.template.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cert.template.logoUrl}
                alt={cert.template.orgName}
                className="h-9 w-auto"
              />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: accent }}
              >
                <GraduationCap size={20} />
              </span>
            )}
            <span
              className="text-sm font-semibold tracking-wide text-neutral-800"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {cert.template.orgName}
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: `${accent}14`, color: accent }}
          >
            <ShieldCheck size={13} />
            Verified credential
          </span>
        </div>

        {/* body */}
        <div className="mt-8 text-center sm:mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-400">
            Certificate of Completion
          </p>
          <p className="mt-5 text-sm text-neutral-500">This certifies that</p>
          <h2
            className="mt-2 text-3xl font-bold text-neutral-900 sm:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {cert.recipientName}
          </h2>
          <div
            className="mx-auto mt-4 h-px w-40"
            style={{ backgroundColor: `${accent}40` }}
          />
          <p className="mt-5 text-sm text-neutral-500">
            has successfully completed the course
          </p>
          <h3 className="mx-auto mt-2 max-w-xl text-lg font-semibold text-neutral-800 sm:text-xl">
            {cert.courseTitle}
          </h3>
        </div>

        {/* footer: signatures + seal */}
        <div className="mt-10 flex items-end justify-between gap-6">
          <div className="text-left">
            <p
              className="text-lg text-neutral-800"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {cert.template.signatoryName}
            </p>
            <div className="mt-1 h-px w-40 bg-neutral-300" />
            <p className="mt-1.5 text-xs text-neutral-500">
              {cert.template.signatoryTitle}
            </p>
          </div>

          {/* embossed seal */}
          <div className="relative hidden shrink-0 sm:block" aria-hidden="true">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full border-2"
              style={{ borderColor: `${accent}55`, color: accent }}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full border"
                style={{ borderColor: `${accent}55` }}
              >
                <GraduationCap size={26} />
              </div>
            </div>
          </div>

          <div className="text-right">
            {cert.instructorName && (
              <>
                <p
                  className="text-lg text-neutral-800"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {cert.instructorName}
                </p>
                <div className="ml-auto mt-1 h-px w-40 bg-neutral-300" />
                <p className="mt-1.5 text-xs text-neutral-500">Course Instructor</p>
              </>
            )}
          </div>
        </div>

        {/* serial + date strip */}
        <div className="mt-8 flex flex-col gap-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Issued{" "}
            <span className="font-medium text-neutral-700">
              {formatIssuedDate(cert.issuedAt)}
            </span>
          </span>
          <span className="tnum">
            Serial{" "}
            <span className="font-semibold tracking-wide text-neutral-800">
              {cert.serial}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
