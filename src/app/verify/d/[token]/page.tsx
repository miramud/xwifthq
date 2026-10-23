import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleCheck, CircleX, CornerUpLeft, FileSearch, ShieldAlert, ThumbsUp } from "lucide-react";
import { getVerifiedDocument, type VerifiedDecision, type VerifiedDocument } from "@/lib/api/documents-server";
import { Clouds } from "@/components/site/Sky";
import { instanceStatus } from "@/suite/approvals/lib/labels";

export const metadata: Metadata = {
  title: "Verify a document",
  robots: { index: false, follow: false },
};

/*
  What a document's QR code opens. Public, no sign-in.

  It answers the one question a reader has (is this paper genuine?) and
  then the next two: what has happened to it since it was printed, and how to
  tell whether the copy in their hand has been altered. It never shows money:
  the API does not send amounts, and nothing here invents one.
*/

const KIND: Record<string, string> = {
  approval_record: "Approval record",
  memo: "Memo",
};

const ACTION: Record<string, { label: string; icon: typeof CircleCheck; tone: string }> = {
  approved: { label: "Approved", icon: CircleCheck, tone: "text-success-600" },
  approved_with_amendment: { label: "Approved with a change", icon: CircleCheck, tone: "text-success-600" },
  recommended: { label: "Recommended", icon: ThumbsUp, tone: "text-primary-600" },
  rejected: { label: "Rejected", icon: CircleX, tone: "text-error-600" },
  returned: { label: "Returned for changes", icon: CornerUpLeft, tone: "text-warning-600" },
};

function when(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(d);
}

/** The fingerprint in groups of eight, so two copies can be compared by eye. */
function groups(hash: string): string[] {
  return hash.toLowerCase().match(/.{1,8}/g) ?? [hash];
}

export default async function VerifyDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await getVerifiedDocument(token);

  if (!doc) {
    return (
      <section className="xw-sky relative isolate overflow-hidden py-20 sm:py-28">
        <Clouds className="-z-10" />
        <div className="section-container flex min-h-[50vh] flex-col items-center justify-center text-center">
          <div className="xw-frame mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl!">
            <FileSearch size={28} className="text-primary-600" aria-hidden />
          </div>
          <h1 className="xw-h2">No document found for this code</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600 sm:text-base">
            This link or QR code doesn&apos;t match anything we have issued. Make sure the whole link was copied. If it
            came from a printed page, ask the issuing organisation for a fresh copy.
          </p>
          <Link href="/" className="btn-primary mt-8">
            Go to the home page
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="xw-sky relative isolate overflow-hidden">
      <div className="section-container py-12 sm:py-16">
        <Verdict doc={doc} />
        <div className="mx-auto mt-8 max-w-3xl space-y-5">
          <DocumentCard doc={doc} />
          {doc.current && <Decisions doc={doc} decisions={doc.current.decisions} />}
          <Fingerprint doc={doc} />
        </div>
      </div>
    </section>
  );
}

function Verdict({ doc }: { doc: VerifiedDocument }) {
  const revoked = !doc.valid;
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div
        className={
          revoked
            ? "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error-500/10 ring-8 ring-error-500/5"
            : "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 ring-8 ring-success-50/60"
        }
      >
        {revoked ? <ShieldAlert size={30} className="text-error-600" aria-hidden /> : <BadgeCheck size={30} className="text-success-600" aria-hidden />}
      </div>
      <p className={revoked ? "text-xs font-bold uppercase tracking-[0.18em] text-error-600" : "text-xs font-bold uppercase tracking-[0.18em] text-success-600"}>
        {revoked ? "Revoked" : "Genuine"}
      </p>
      <h1 className="xw-h2 mt-2">
        {revoked ? "This document was withdrawn" : "This document is genuine"}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
        {revoked ? (
          <>
            {doc.issuer.name} issued it, then revoked it on {when(doc.revoked?.at)}
            {doc.revoked?.reason ? <> (“{doc.revoked.reason}”)</> : null}. Don&apos;t rely on it.
          </>
        ) : (
          <>
            Issued by <span className="font-semibold text-neutral-800">{doc.issuer.name}</span> and recorded on our register.
          </>
        )}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="break-words text-sm font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

function DocumentCard({ doc }: { doc: VerifiedDocument }) {
  const status = doc.current ? instanceStatus(doc.current.status) : null;
  return (
    <article className="xw-frame p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{KIND[doc.kind] ?? doc.kind.replace(/_/g, " ")}</p>
      <h2 className="mt-1 font-heading text-xl font-bold tracking-[-0.02em] text-neutral-900">
        {doc.title}
      </h2>
      <dl className="mt-3 divide-y divide-neutral-100">
        <Row label="Reference">{doc.reference ?? "None"}</Row>
        <Row label="Issued by">
          {doc.issuer.name}
          {doc.issuer.legalName && doc.issuer.legalName !== doc.issuer.name && <span className="block text-neutral-500">{doc.issuer.legalName}</span>}
        </Row>
        <Row label="Issued">
          {when(doc.issuedAt)}
          {doc.issuedBy && <span className="text-neutral-500"> · by {doc.issuedBy}</span>}
        </Row>
        {status && (
          <Row label="Status now">
            {status.label}
            {doc.current?.completedAt && <span className="text-neutral-500"> · since {when(doc.current.completedAt)}</span>}
          </Row>
        )}
      </dl>
    </article>
  );
}

function Decisions({ decisions }: { doc: VerifiedDocument; decisions: VerifiedDecision[] }) {
  return (
    <article className="xw-frame p-5 sm:p-6">
      <h2 className="text-base font-semibold text-neutral-900">Decisions</h2>
      {decisions.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">Nobody has decided on it yet.</p>
      ) : (
        <ol className="mt-3 divide-y divide-neutral-100">
          {decisions.map((d, i) => {
            const a = ACTION[d.action] ?? { label: d.action.replace(/_/g, " "), icon: CircleCheck, tone: "text-neutral-500" };
            const Icon = a.icon;
            return (
              <li key={`${d.at}-${i}`} className="flex items-start gap-3 py-3">
                <Icon size={18} className={`mt-0.5 shrink-0 ${a.tone}`} aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="text-neutral-900">
                    <span className="font-semibold">{a.label}</span> by {d.by}
                  </p>
                  <p className="text-neutral-500">
                    {d.stage} · {when(d.at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

function Fingerprint({ doc }: { doc: VerifiedDocument }) {
  return (
    <article className="xw-frame p-5 sm:p-6">
      <h2 className="text-base font-semibold text-neutral-900">Check your copy</h2>
      <p className="mt-1 text-sm text-neutral-600">
        This is the SHA-256 fingerprint of the file we issued. Any SHA-256 tool gives the same fingerprint for an untouched copy.
        A copy whose fingerprint differs has been altered.
      </p>
      <p className="mt-4 flex flex-wrap gap-x-2 gap-y-1 rounded-xl bg-neutral-50 px-4 py-3 font-mono text-[13px] tracking-wide text-neutral-800" aria-label={`SHA-256 ${doc.sha256}`}>
        {groups(doc.sha256).map((g, i) => (
          <span key={i} aria-hidden>
            {g}
          </span>
        ))}
      </p>
      {doc.bytes != null && <p className="mt-2 text-xs text-neutral-500">File size: {doc.bytes.toLocaleString("en-GB")} bytes</p>}
    </article>
  );
}
