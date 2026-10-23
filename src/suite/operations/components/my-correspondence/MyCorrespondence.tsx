"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlarmClock, Inbox, MailCheck, MailOpen } from "lucide-react";
import { PageHeader, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { myCorrespondence, opsError, type Letter } from "@/lib/api/operations-correspondence-client";
import { ConfidentialChip, DirectionMark, DueChip, LetterStatusChip, RefStamp } from "@/suite/operations/components/correspondence/parts";
import { IN_OPEN, dayText } from "@/suite/operations/components/correspondence/labels";

/** Waiting on me first (newly routed, then in hand), the most urgent due date first. */
export function myOrder(a: Letter, b: Letter): number {
  const rank = (l: Letter) => (l.status === "assigned" ? 0 : l.status === "in_progress" ? 1 : l.status === "responded" ? 2 : 3);
  return rank(a) - rank(b) || (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999");
}

/**
 * Letters routed to me for action: what I still have to do, what is late,
 * and what I have answered recently. Each opens to acknowledge, minute,
 * forward, upload the reply and mark it responded.
 */
export default function MyCorrespondence() {
  const [rows, setRows] = useState<Letter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<"todo" | "done">("todo");

  useEffect(() => {
    let alive = true;
    myCorrespondence.list().then(
      (r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Your letters didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error && !rows) {
    return (
      <div>
        <PageHeader title="Letters for my action" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!rows) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading your letters…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const todo = rows.filter((l) => IN_OPEN.includes(l.status)).sort(myOrder);
  const done = rows.filter((l) => !IN_OPEN.includes(l.status)).sort(myOrder);
  const late = todo.filter((l) => l.overdue).length;
  const shown = tab === "todo" ? todo : done;

  return (
    <div>
      <PageHeader title="Letters for my action" subtitle="Correspondence the registry has routed to you. Acknowledge it, act on it, and mark it responded." />
      <div className="space-y-5">
        <StatGrid cols={3}>
          <StatCard featured label="To act on" value={todo.length} icon={MailOpen} hint={todo.some((l) => l.status === "assigned") ? `${todo.filter((l) => l.status === "assigned").length} not yet acknowledged` : "All acknowledged"} />
          <StatCard label="Overdue" value={late} icon={AlarmClock} hue={late ? "rose" : "mint"} hint={late ? "Past the date they were due" : "Nothing late"} />
          <StatCard label="Answered" value={done.length} icon={MailCheck} hue="mint" hint="Responded or closed, last 90 days" />
        </StatGrid>

        <div className="flex items-center justify-between gap-3">
          <Segmented
            label="Which letters"
            value={tab}
            onChange={setTab}
            options={[
              { key: "todo", label: `To do (${todo.length})` },
              { key: "done", label: `Answered (${done.length})` },
            ]}
          />
        </div>

        {shown.length === 0 ? (
          <div className="ws-card px-6 py-14 text-center">
            <Inbox size={22} className="mx-auto mb-3 text-neutral-400" aria-hidden />
            <p className="text-[15px] font-semibold text-neutral-900">{tab === "todo" ? "Nothing waiting on you." : "Nothing answered yet."}</p>
            <p className="mt-1 text-sm text-neutral-500">{tab === "todo" ? "When the registry routes a letter to you, it appears here and you are notified." : "Letters you respond to stay here for 90 days."}</p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label={tab === "todo" ? "Letters to act on" : "Letters answered"}>
            {shown.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/suite/operations/my/correspondence/${l.id}`}
                  className={cx(
                    "ws-card flex flex-col gap-3 p-4 outline-none transition hover:border-primary-300 focus-visible:ring-2 focus-visible:ring-primary-300 sm:flex-row sm:items-center",
                    l.overdue && "border-rose-200 bg-rose-50/40",
                  )}
                >
                  <DirectionMark direction={l.direction} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-neutral-900">{l.subject}</span>
                    <span className="mt-0.5 block truncate text-xs text-neutral-500">
                      From {l.party ?? "-"} · received {dayText(l.receivedOn)}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <RefStamp reference={l.reference} />
                      {l.confidentiality === "confidential" && <ConfidentialChip />}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <DueChip letter={l} />
                    <LetterStatusChip status={l.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
