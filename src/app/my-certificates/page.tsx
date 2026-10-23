"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { myCertificates as api, ApiError } from "@/lib/api/saas-client";
import { type CertificateData, formatIssuedDate } from "@/suite/lms/lib/certificate";
import CertificateCard from "@/suite/lms/components/certificate/CertificateCard";
import { useAuth } from "@/lib/auth-store";
import { LEARNER_CARD, LearnerHeader, PILL_OUTLINE } from "@/components/learner/LearnerHeader";

/**
 * What the learner has earned.
 *
 * `GET /me/certificates` had no caller: a learner could verify a serial
 * somebody handed them and had no way to see their own. That is the wrong way
 * round — the person who needs the list is the holder, at the moment a
 * registrar asks them to evidence their training.
 *
 * So this page is built for **revalidation**, not for a trophy cabinet. The
 * ordering is by what needs attention: lapsed and lapsing first, then
 * everything that is simply in date. A grid of medallions sorted by date
 * earned would bury the one certificate that expires in a fortnight, which is
 * the only one anybody has to do something about.
 *
 * Expired and revoked stay separate here as they do everywhere else. Expired
 * means it was earned properly and has run its term; revoked means the
 * institution took it back. Merging them would accuse somebody.
 */

/** Inside this many days, an in-date certificate is worth acting on. */
const SOON_DAYS = 60;

type Bucket = "revoked" | "expired" | "soon" | "valid";

function bucketOf(cert: CertificateData): Bucket {
  if (cert.revoked) return "revoked";
  if (cert.expired) return "expired";
  if (
    cert.expires &&
    cert.daysUntilExpiry !== null &&
    cert.daysUntilExpiry <= SOON_DAYS
  ) {
    return "soon";
  }

  return "valid";
}

const ORDER: Bucket[] = ["expired", "soon", "revoked", "valid"];

export default function MyCertificatesPage() {
  const { user, loading: authLoading } = useAuth();

  const [certificates, setCertificates] = useState<CertificateData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CertificateData | null>(null);

  /* Both writes land in the promise callback: a setState in an effect body is
     a cascading render React has to redo. */
  const load = useCallback(() => {
    api
      .list()
      .then((data) => {
        setCertificates(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError ? err.message : "Couldn't load your certificates.",
        ),
      );
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const sorted = useMemo(() => {
    if (certificates === null) return null;

    return [...certificates].sort((a, b) => {
      const rank = ORDER.indexOf(bucketOf(a)) - ORDER.indexOf(bucketOf(b));

      if (rank !== 0) return rank;

      /* Within a bucket, soonest first where a date matters, newest first
         where it does not. */
      if (bucketOf(a) === "soon") {
        return (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0);
      }

      return (b.issuedAt ?? "").localeCompare(a.issuedAt ?? "");
    });
  }, [certificates]);

  const needsAttention = useMemo(
    () =>
      (sorted ?? []).filter((c) => {
        const bucket = bucketOf(c);

        return bucket === "expired" || bucket === "soon";
      }).length,
    [sorted],
  );

  if (!authLoading && !user) {
    return (
      <Frame>
        <div className={`${LEARNER_CARD} p-10 text-center`}>
          <p className="text-neutral-600">Log in to see the certificates you hold.</p>
          <Link href="/login?redirect=/my-certificates" className="btn-primary mt-5">
            Log in
          </Link>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      {error !== null && (
        <div className={`${LEARNER_CARD} p-8 text-center`}>
          <p className="text-sm text-neutral-600">{error}</p>
          <button
            type="button"
            onClick={load}
            className={`${PILL_OUTLINE} mt-4`}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {sorted === null && error === null && (
        <div className="space-y-4" role="status" aria-busy="true">
          <span className="sr-only">Loading your certificates</span>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[1.25rem] bg-neutral-100 motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {sorted !== null && sorted.length === 0 && (
        <div className="xw-tile p-10 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-600 shadow-[0_1px_2px_rgb(16_18_31/0.06)]">
            <Award className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="font-medium text-neutral-700">No certificates yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            Finishing a course that awards one puts it here, with its serial and
            the date it runs to.
          </p>
          <Link href="/my-courses" className="btn-outline mt-5">
            Your courses
          </Link>
        </div>
      )}

      {sorted !== null && sorted.length > 0 && (
        <>
          {/*
            Said once at the top rather than left to be counted off the list.
            Somebody with fourteen certificates and two lapsing wants the two.
          */}
          {needsAttention > 0 && (
            <p className="mb-5 flex items-start gap-2 rounded-2xl border border-warning-200 bg-warning-50/60 px-4 py-3 text-sm text-warning-800">
              <TriangleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                {needsAttention === 1
                  ? "One certificate has lapsed or is close to it."
                  : `${needsAttention} certificates have lapsed or are close to it.`}{" "}
                Taking the course again issues a new one.
              </span>
            </p>
          )}

          <ul className="space-y-3">
            {sorted.map((cert) => (
              <li key={cert.serial}>
                <CertificateRow cert={cert} onView={() => setViewing(cert)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {viewing !== null && (
        <Viewer cert={viewing} onClose={() => setViewing(null)} />
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LearnerHeader
        narrow
        eyebrow={
          <>
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            Learning
          </>
        }
        title="My certificates"
        intro="Everything you have earned, with the serial to quote and the date it runs to."
      />
      <div className="section-container pb-16 pt-2 sm:pb-20">
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function CertificateRow({
  cert,
  onView,
}: {
  cert: CertificateData;
  onView: () => void;
}) {
  const bucket = bucketOf(cert);

  return (
    <article
      className={`rounded-[1.25rem] border bg-white p-5 shadow-[0_1px_2px_rgb(16_18_31/0.04),0_24px_48px_-36px_rgb(150_56_205/0.35)] sm:p-6 ${
        bucket === "revoked" || bucket === "expired" ? "border-neutral-300" : "border-neutral-200/80"
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold text-neutral-800">
              {cert.courseTitle}
            </h2>
            <StatusPill cert={cert} />
            {/*
              Which round of recurring training this is. Somebody on their
              third annual renewal has a better record than somebody on their
              first, and the certificate is the only place that shows it.
            */}
            {cert.cycle > 1 && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                {ordinal(cert.cycle)} issue
              </span>
            )}
          </div>

          <p className="mt-1.5 text-sm text-neutral-500">
            Issued {formatIssuedDate(cert.issuedAt)}
            {cert.template.orgName ? ` by ${cert.template.orgName}` : ""}
          </p>

          <p className="mt-1 font-mono text-xs text-neutral-400">{cert.serial}</p>

          <ExpiryLine cert={cert} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" onClick={onView} className={PILL_OUTLINE}>
            View
          </button>
          {/*
            The link to hand somebody else. It is the public verification page,
            so what the registrar sees is the institution's answer rather than
            a screenshot the holder produced.
          */}
          <Link
            href={`/verify/${encodeURIComponent(cert.serial)}`}
            className={PILL_OUTLINE}
          >
            <ShieldCheck size={13} aria-hidden="true" />
            Verification page
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatusPill({ cert }: { cert: CertificateData }) {
  if (cert.revoked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-error-500/10 px-2.5 py-1 text-xs font-medium text-error-700">
        <XCircle className="h-3 w-3" aria-hidden="true" />
        Withdrawn
      </span>
    );
  }

  if (cert.expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700">
        <CalendarClock className="h-3 w-3" aria-hidden="true" />
        Out of date
      </span>
    );
  }

  if (bucketOf(cert) === "soon") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning-500/10 px-2.5 py-1 text-xs font-medium text-warning-700">
        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
        Expiring
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-700">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      In date
    </span>
  );
}

/**
 * The line that does the work on this page.
 *
 * "Expires 14 March 2027" is a fact; "expires in 23 days" is a prompt. Both
 * are printed, because the first is what somebody quotes to a registrar and
 * the second is what makes them act.
 */
function ExpiryLine({ cert }: { cert: CertificateData }) {
  if (cert.revoked) {
    return (
      <p className="mt-2 text-sm text-error-700">
        Withdrawn by the institution
        {cert.revokedAt ? ` on ${formatIssuedDate(cert.revokedAt)}` : ""}. Ask
        them if you think that is wrong.
      </p>
    );
  }

  if (!cert.expires) {
    return <p className="mt-2 text-sm text-neutral-500">Does not expire.</p>;
  }

  const on = formatIssuedDate(cert.expiresAt);
  const days = cert.daysUntilExpiry;

  if (cert.expired) {
    return (
      <p className="mt-2 text-sm text-neutral-700">
        Ran out on {on}
        {days !== null && days < 0 ? ` (${Math.abs(days)} days ago)` : ""}. Take
        the course again to be issued a new one.
      </p>
    );
  }

  return (
    <p
      className={`mt-2 text-sm ${
        bucketOf(cert) === "soon" ? "text-warning-800" : "text-neutral-600"
      }`}
    >
      Valid until {on}
      {days !== null && ` (${days === 0 ? "today" : `${days} days left`})`}
    </p>
  );
}

/**
 * The document itself.
 *
 * Shown in place rather than on its own route: there is already a printable
 * certificate component, and the thing a learner does here is print it or
 * screenshot it and go back to the list.
 */
function Viewer({ cert, onClose }: { cert: CertificateData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto overscroll-contain bg-neutral-900/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl sm:my-auto">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close certificate"
            className="rounded-full bg-white/90 p-2.5 text-neutral-700 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={16} />
          </button>
        </div>

        <CertificateCard cert={cert} />

        {/*
          Said under the document, because a printed page cannot show it. A
          withdrawn or lapsed certificate still renders — hiding it would leave
          somebody unable to see what they are being told about.
        */}
        {!cert.valid && (
          <p className="mt-3 rounded-xl bg-white/90 px-4 py-3 text-sm text-neutral-700">
            {cert.revoked
              ? "This certificate has been withdrawn, and the verification page says so."
              : "This certificate is out of date, and the verification page says so."}
          </p>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const rest = n % 100;

  if (rest >= 11 && rest <= 13) return `${n}th`;

  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
