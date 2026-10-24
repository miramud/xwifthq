"use client";

import { useEffect, useState } from "react";
import { CalendarClock, FileCheck2, FileClock, FileText, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Chip, Empty, PageHeader, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor } from "@/components/workspace/modules";
import { hrm, type ExpiringDocument } from "@/lib/api/hrm-client";
import { formatDate } from "@/suite/hrm/lib/format";
import { IconTile, LoadError, PersonCell, ToneChip } from "../ui/recordKit";

const WINDOWS = [30, 60, 90] as const;

/**
 * Registrations, visas and right-to-work documents coming up for renewal.
 *
 * The endpoint has existed since personal records were built and had no
 * screen, so the only way to find an expiring nursing registration was to open
 * each person in turn. An institution does not discover a lapsed registration
 * by browsing; it discovers it when somebody is already on shift.
 *
 * The board is built around one distinction, and everything else is detail:
 *
 * **Expired and blocking is not the same as expiring.** A lapsed registration
 * on somebody rostered tomorrow is a shift the institution cannot defend, and
 * it belongs at the top in its own words. A visa with eleven weeks left is
 * ordinary administration. Merging them into one "attention needed" list makes
 * the urgent item the ninth row of a table nobody finishes reading.
 *
 * The window is adjustable because notice periods genuinely differ, a visa is
 * chased three months out and a DBS check is not, and the default of 60 days
 * is long enough to act on without burying today's problem.
 */
export default function RenewalsBoard() {
  const [withinDays, setWithinDays] = useState<number>(60);
  const [rows, setRows] = useState<ExpiringDocument[] | null>(null);
  const [blockingWork, setBlockingWork] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    /*
      The previous window's rows stay on screen while the new one loads rather
      than being cleared to a skeleton. Changing 60d to 90d only ever adds
      rows, so blanking the list makes the lapsed registration at the top
      disappear and come back for no reason.
    */
    hrm.employees
      .expiringDocuments(withinDays)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setBlockingWork(result.meta.blockingWork);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [withinDays]);

  const header = (
    <PageHeader title="Renewals" subtitle="Documents that expire, and how long is left on them." />
  );

  if (error !== null) {
    return (
      <div>
        {header}
        <LoadError message={error} />
      </div>
    );
  }

  const blocking = (rows ?? []).filter((row) => row.blocksWork);
  const rest = (rows ?? []).filter((row) => !row.blocksWork);
  // Lapsed first, always, whatever the sort of the rest.
  const ordered = [...blocking, ...rest];
  const lapsed = (rows ?? []).filter((r) => r.hasExpired).length;
  const soon = (rows ?? []).filter((r) => !r.hasExpired && r.daysUntilExpiry !== null && r.daysUntilExpiry <= 30).length;
  const unverified = (rows ?? []).filter((r) => !r.isVerified).length;

  const windows = (
    <div role="group" aria-label="Expiring within" className="inline-flex rounded-xl bg-neutral-100 p-1">
      {WINDOWS.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => setWithinDays(days)}
          aria-pressed={withinDays === days}
          className={cx(
            "h-8 cursor-pointer rounded-lg px-3 text-[13px] font-semibold transition",
            withinDays === days ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800",
          )}
        >
          {days}d
        </button>
      ))}
    </div>
  );

  const columns: Column<ExpiringDocument>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      sortable: true,
      value: (r) => r.name ?? "",
      render: (r) => (
        <PersonCell
          name={r.name ?? "Unnamed"}
          sub={`${r.jobTitle ?? "-"} · ${r.kindLabel}${r.reference !== null ? ` · ${r.reference}` : ""}`}
          href={`/suite/hrm/people/${r.employeeId}`}
        />
      ),
    },
    {
      key: "document",
      header: "Document",
      sortable: true,
      value: (r) => r.title,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={FileText} hue={hueFor(r.kindLabel)} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-neutral-800">{r.title}</span>
            <span className="block truncate text-xs text-neutral-500">
              {r.hasExpired ? "Expired" : "Expires"} {formatDate(r.expiresOn)}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "left",
      header: "Time left",
      sortable: true,
      value: (r) => r.daysUntilExpiry ?? -9999,
      render: (r) => <Standing row={r} />,
    },
  ];

  return (
    <div>
      {header}

      <div className="space-y-6">
        {/*
          Stated as a problem, not a count. Somebody working on a lapsed
          registration is not a tidiness issue, and the header is the only place
          it will be read before it becomes one.
        */}
        {blockingWork > 0 && (
          <div className="flex items-start gap-3 rounded-[1.25rem] border border-coral-100 bg-coral-50/70 p-4 sm:p-5">
            <IconTile icon={ShieldAlert} hue="coral" size={38} className="bg-white" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                {blockingWork} {blockingWork === 1 ? "person cannot" : "people cannot"} be rostered
              </h2>
              <p className="mt-1 text-sm text-neutral-700">
                Their registration or right to work has lapsed. A shift worked on an expired registration is one the
                institution cannot defend.
              </p>
            </div>
          </div>
        )}

        {rows !== null && (
          <StatGrid>
            <StatCard icon={FileClock} hue="blue" label="Due for renewal" value={rows.length} hint={`Within ${withinDays} days`} />
            <StatCard icon={ShieldAlert} hue={lapsed > 0 ? "coral" : "mint"} label="Already lapsed" value={lapsed} hint="Past the expiry date" />
            <StatCard icon={CalendarClock} hue="sun" label="Within 30 days" value={soon} hint="Chase these first" />
            <StatCard icon={ShieldQuestion} hue="grape" label="Not verified" value={unverified} hint="Nobody has seen the document" />
          </StatGrid>
        )}

        {rows === null ? (
          <div className="ws-card h-32 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />
        ) : (
          <DataView
            rows={ordered}
            columns={columns}
            rowKey={(r) => r.id}
            storageKey="hrm.renewals"
            caption="Documents due for renewal"
            searchPlaceholder="Search people or documents"
            toolbar={windows}
            empty={
              <Empty
                icon={FileCheck2}
                hue="mint"
                title="Nothing to renew"
                hint={`No document on file expires in the next ${withinDays} days. Documents with no expiry (a degree certificate, say) never appear here.`}
              />
            }
            renderCard={(r) => (
              <div className={cx("flex h-full flex-col gap-4 p-5", r.blocksWork && "bg-coral-50/40")}>
                <PersonCell
                  name={r.name ?? "Unnamed"}
                  sub={r.jobTitle ?? "-"}
                  href={`/suite/hrm/people/${r.employeeId}`}
                  size={44}
                />
                <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
                  <IconTile icon={FileText} hue={hueFor(r.kindLabel)} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{r.title}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {r.hasExpired ? "Expired" : "Expires"} {formatDate(r.expiresOn)}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <Chip hue={hueFor(r.kindLabel)}>{r.kindLabel}</Chip>
                  <Standing row={r} />
                </div>
              </div>
            )}
            renderListItem={(r) => (
              <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <PersonCell
                    name={r.name ?? "Unnamed"}
                    sub={`${r.jobTitle ?? "-"} · ${r.kindLabel}${r.reference !== null ? ` · ${r.reference}` : ""}`}
                    href={`/suite/hrm/people/${r.employeeId}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-700">{r.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {r.hasExpired ? "Expired" : "Expires"} {formatDate(r.expiresOn)}
                  </p>
                </div>
                <Standing row={r} />
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}

function Standing({ row }: { row: ExpiringDocument }) {
  const days = row.daysUntilExpiry;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {/*
        Three states, not two. "Expired" alone does not say whether anybody
        has to do something today, and `blocksWork` is the only field that
        answers it.
      */}
      {row.blocksWork ? (
        <ToneChip tone="error">Cannot work</ToneChip>
      ) : row.hasExpired ? (
        <ToneChip tone="warning">Expired</ToneChip>
      ) : (
        <ToneChip tone={days !== null && days <= 30 ? "warning" : "neutral"}>
          {days === null ? "Expiring" : `${days}d left`}
        </ToneChip>
      )}

      {!row.isVerified && (
        /*
          Worth saying next to an expiry. Chasing a renewal for a document
          nobody ever checked is chasing a claim rather than a credential.
        */
        <ToneChip tone="neutral" dot={false}>
          Unverified
        </ToneChip>
      )}
    </span>
  );
}
