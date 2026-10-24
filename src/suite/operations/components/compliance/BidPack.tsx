"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, CircleCheck, Download, FileText, FileX2, Star } from "lucide-react";
import { CalloutStrip, Card, Empty, PageHeader, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { SegmentedGauge } from "@/components/workspace/charts";
import { todayYmd } from "@/components/workspace/Calendar";
import { BackLink, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { compliance, opsError, type BidPackPreview } from "@/lib/api/operations-compliance-client";
import { CertStateChip } from "./parts";
import { daysBetween } from "./labels";

/**
 * The bid-readiness pack: every certificate marked for bids that is valid
 * today goes in, with an index; what is missing or expired is listed with
 * why, so it can be renewed before the tender closes.
 */
export default function BidPack() {
  const [pack, setPack] = useState<BidPackPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    compliance.bidPack().then(
      (p) => {
        if (!alive) return;
        setPack(p);
        setError(null);
      },
      (e: unknown) => alive && setError(`The bid pack didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const header = (ready: boolean) => (
    <PageHeader
      title="Bid-readiness pack"
      subtitle="The certificates a tender asks for, in one download with an index. Only certificates valid today go in."
      actions={
        ready ? (
          <a href={compliance.bidPackHref} download className={buttonClass("primary")}>
            <Download size={17} aria-hidden />
            Download pack (ZIP)
          </a>
        ) : undefined
      }
    />
  );

  if (error && !pack) {
    return (
      <div>
        <BackLink href="/suite/operations/compliance" label="Compliance" />
        {header(false)}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!pack) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the bid pack…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const total = pack.included.length + pack.missing.length;

  return (
    <div>
      <BackLink href="/suite/operations/compliance" label="Compliance" />
      {header(pack.included.length > 0)}

      {total === 0 ? (
        <Card>
          <Empty
            icon={Briefcase}
            title="No certificate is marked for the bid pack"
            hint="Edit a certificate on the compliance register and switch on “Goes in the bid pack”."
            action={
              <Link href="/suite/operations/compliance" className={buttonClass("secondary")}>
                Open the register
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Ready for a tender" subtitle="Certificates in the pack, of those marked for it" icon={Briefcase} hue="blue">
            <div className="flex flex-col items-center">
              <SegmentedGauge
                value={pack.included.length}
                max={total}
                hue={pack.missing.length === 0 ? "mint" : "sun"}
                label="Certificates in the pack"
                display={
                  <span className="tabular-nums">
                    {pack.included.length}
                    <span className="text-base font-semibold text-neutral-500">/{total}</span>
                  </span>
                }
                caption={pack.missing.length === 0 ? "Every certificate is current." : `${pack.missing.length} to renew or file before the pack is complete.`}
              />
            </div>
            <CalloutStrip icon={FileText} hue="slate" title="What the ZIP holds" className="mt-4">
              An index (with a QR code to verify it) and each certificate&rsquo;s file, numbered in the index&rsquo;s order.
            </CalloutStrip>
          </Panel>

          <div className="min-w-0 space-y-6 xl:col-span-2">
            <Panel title="Goes in" subtitle={`${pack.included.length} valid ${pack.included.length === 1 ? "certificate" : "certificates"}`} icon={CircleCheck} hue="mint">
              {pack.included.length === 0 ? (
                <p className="py-4 text-sm text-neutral-500">Nothing yet: every certificate marked for bids is missing or expired.</p>
              ) : (
                <ol className="space-y-2">
                  {pack.included.map((c, i) => {
                    const left = c.expiresOn ? daysBetween(today, c.expiresOn) : null;
                    return (
                      <li key={c.obligationId} className="flex items-center gap-3 rounded-2xl border border-neutral-100 px-4 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 font-mono text-xs font-bold text-primary-700" aria-hidden>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-neutral-900">{c.name}</span>
                            {c.mandatory && <Star size={12} className="shrink-0 fill-neutral-300 text-neutral-400" aria-label="Mandatory" />}
                          </span>
                          <span className="block truncate text-xs text-neutral-500">
                            {c.issuedOn ? `Issued ${day(c.issuedOn)} · ` : ""}
                            {c.expiresOn ? `expires ${day(c.expiresOn)}` : "no expiry"}
                            {left !== null && left <= 60 ? ` · ${left} days left` : ""}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            {c.files.map((f) => (
                              <a
                                key={f.id}
                                href={compliance.evidenceHref(f.id)}
                                className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 outline-none hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-primary-300"
                              >
                                <FileText size={11} aria-hidden />
                                {f.name}
                              </a>
                            ))}
                          </span>
                        </span>
                        <CertStateChip state={c.state} />
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>

            <Panel title="Left out" subtitle={pack.missing.length ? "Renew or file these to complete the pack" : "Nothing left out"} icon={FileX2} hue={pack.missing.length ? "rose" : "slate"}>
              {pack.missing.length === 0 ? (
                <p className="py-4 text-sm text-neutral-500">Every certificate marked for bids is in the pack.</p>
              ) : (
                <ul className="space-y-2">
                  {pack.missing.map((c) => {
                    const red = c.mandatory && c.state === "expired";
                    const body = (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className={cx("block truncate text-sm font-semibold", red ? "text-error-700" : "text-neutral-900")}>
                            {c.name}
                            {c.mandatory && <span className="ml-2 text-xs font-medium text-neutral-500">Mandatory</span>}
                          </span>
                          <span className={cx("block text-xs", red ? "text-error-700" : "text-neutral-600")}>{c.reason}</span>
                        </span>
                        <CertStateChip state={c.state} />
                        {c.occurrenceId && <ArrowRight size={15} className="shrink-0 text-neutral-400" aria-hidden />}
                      </>
                    );
                    const cls = cx("flex items-center gap-3 rounded-2xl border px-4 py-3", red ? "border-error-500/20 bg-error-500/5" : "border-neutral-100");
                    return (
                      <li key={c.obligationId}>
                        {c.occurrenceId ? (
                          <Link href={`/suite/operations/compliance/${c.occurrenceId}`} className={cx(cls, "outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300")}>
                            {body}
                          </Link>
                        ) : (
                          <div className={cls}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
