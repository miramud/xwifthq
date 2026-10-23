"use client";

import { use, useEffect, useState } from "react";
import {
  Award,
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ExternalLink,
  GraduationCap,
  Mail,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Panel, buttonClass } from "@/components/workspace/kit";
import {
  BackLink,
  ErrorNote,
  FaceAvatar,
  InfoList,
  InfoRow,
  Skeleton,
} from "@/suite/lms/components/ui/ws";
import {
  issuedCertificates as api,
  ApiError,
  type AdminCertificateDetail,
} from "@/lib/api/admin-client";

/**
 * One certificate, as the institution sees it.
 *
 * The public verification page answers "is this real", which is not the
 * question an administrator has when they are about to revoke something. That
 * question is: who holds it, what did they do to earn it, and is this their
 * first or their fourth renewal.
 *
 * Revoking is the reason the page exists, and the reason it states the
 * difference between the two ways a certificate stops counting. **Revoking
 * says the institution takes it back** — an error, or worse — and it follows
 * the holder. **Expiring** means it was earned properly and has run its term.
 * Somebody reaching for revoke on a lapsed certificate is about to say
 * something untrue about a person who did nothing wrong.
 */
export default function CertificateDetailPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = use(params);

  const [certificate, setCertificate] = useState<AdminCertificateDetail | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    api
      .get(serial)
      .then((data) => {
        if (alive) setCertificate(data);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(
          e instanceof ApiError && e.status === 404
            ? "No certificate matches that serial."
            : "Couldn't load this certificate.",
        );
      });

    return () => {
      alive = false;
    };
  }, [serial]);

  async function toggleRevoked(revoked: boolean) {
    setBusy(true);

    try {
      if (revoked) {
        await api.reinstate(serial);
      } else {
        await api.revoke(serial);
      }

      setCertificate(await api.get(serial));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && certificate === null) {
    return (
      <Card>
        <Empty
          icon={Award}
          hue="grape"
          title={error}
          action={
            <ButtonLink href="/suite/lms/certificates" variant="primary">
              Back to certificates
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  if (certificate === null) {
    return (
      <div className="space-y-4" role="status" aria-busy="true">
        <span className="sr-only">Loading certificate</span>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  /*
    Three states, kept apart everywhere. Revoked means the institution took it
    back; expired means it was earned properly and ran its term. One word for
    both would be a false statement about the holder, made to the audience
    most likely to act on it.
  */
  const state = certificate.revoked ? (
    <Chip hue="rose" icon={ShieldAlert}>
      Revoked
    </Chip>
  ) : certificate.expired ? (
    <Chip hue="sun" icon={CalendarX}>
      Expired
    </Chip>
  ) : (
    <Chip hue="mint" icon={ShieldCheck}>
      Valid
    </Chip>
  );

  const holder = certificate.learner.name ?? certificate.recipientName;

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/suite/lms/certificates" label="Back to certificates" />
        <PageHeader
          eyebrow="Certificate"
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="tracking-wide">{certificate.serial}</span>
              {state}
              {certificate.cycle > 1 && <Chip hue="slate">Renewal {certificate.cycle}</Chip>}
            </span>
          }
          subtitle={certificate.courseTitle}
          actions={
            certificate.verifyUrl !== null ? (
              <a href={certificate.verifyUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
                See what a verifier sees
                <ExternalLink size={15} aria-hidden />
              </a>
            ) : undefined
          }
        />
      </div>

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title="Details" icon={Award} hue="grape">
            <InfoList cols={2}>
              <InfoRow icon={UserRound} label="Holder" hue="sky">
                {holder}
              </InfoRow>
              <InfoRow icon={Mail} label="Address" hue="blue">
                {certificate.learner.email ?? "-"}
              </InfoRow>
              <InfoRow icon={BadgeCheck} label="Named on the certificate" hue="grape">
                {certificate.recipientName}
              </InfoRow>
              <InfoRow icon={GraduationCap} label="Instructor" hue="mint">
                {certificate.instructorName ?? "-"}
              </InfoRow>
              <InfoRow icon={CalendarCheck} label="Issued" hue="mint">
                {formatDate(certificate.issuedAt)}
              </InfoRow>
              <InfoRow icon={CalendarClock} label={certificate.expired ? "Expired" : "Valid until"} hue="sun">
                {certificate.expiresAt === null ? "Never expires" : formatDate(certificate.expiresAt)}
              </InfoRow>
              {certificate.revokedAt !== null && (
                <InfoRow icon={ShieldAlert} label="Revoked" hue="rose">
                  {formatDate(certificate.revokedAt)}
                </InfoRow>
              )}
            </InfoList>

            {/*
              The evidence behind the claim. A certificate asserts that somebody
              completed work, and the enrollment is the only record of that the
              institution holds.
            */}
            <div className="mt-4 rounded-2xl border border-neutral-200/80 bg-neutral-50 p-4">
              <p className="text-xs font-semibold text-neutral-500">What it was issued for</p>
              {certificate.enrollment === null ? (
                <p className="mt-1 text-sm text-neutral-700">
                  The enrollment behind this certificate no longer exists. The certificate still verifies: it is a
                  record of what happened, not a live claim about an enrollment.
                </p>
              ) : (
                <p className="mt-1 text-sm text-neutral-700">
                  {certificate.enrollment.status}
                  {certificate.enrollment.completedAt !== null &&
                    ` · finished ${formatDate(certificate.enrollment.completedAt)}`}
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-grape-600 to-primary-600 p-5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                Certificate of completion
              </p>
              <p className="mt-3 text-lg font-bold leading-snug">{certificate.recipientName}</p>
              <p className="mt-1 line-clamp-2 text-sm text-white/85">{certificate.courseTitle}</p>
            </div>
            <div className="flex items-center gap-3 p-4">
              <FaceAvatar name={holder} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">{holder}</p>
                <p className="truncate text-xs text-neutral-500">{certificate.learner.email ?? "-"}</p>
              </div>
            </div>
          </Card>

          <Panel
            title={certificate.revoked ? "Reinstate" : "Revoke"}
            subtitle="Verification reports whatever you decide here, immediately."
            icon={certificate.revoked ? RotateCcw : ShieldAlert}
            hue={certificate.revoked ? "mint" : "rose"}
          >
            {/*
              Said before the button, not after. Revoking a lapsed certificate is
              the mistake this page exists to prevent: the holder did nothing
              wrong, and a verifier told "revoked" hears that they did.
            */}
            {!certificate.revoked && certificate.expired && (
              <p className="mb-3 rounded-xl bg-sun-50 px-3 py-2.5 text-xs text-neutral-700">
                This certificate has already expired. It stopped counting on its own and the holder did nothing wrong.
                Revoking it would tell a verifier the institution took it back.
              </p>
            )}

            <Button
              variant={certificate.revoked ? "primary" : "danger"}
              disabled={busy}
              onClick={() => void toggleRevoked(certificate.revoked)}
            >
              {certificate.revoked ? "Reinstate it" : "Revoke it"}
            </Button>

            <p className="mt-3 text-xs text-neutral-500">
              {certificate.revoked
                ? "Reinstating makes it verify as genuine again."
                : "Anybody checking the serial is told it was revoked. The holder is not notified."}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (iso === null) return "-";

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
