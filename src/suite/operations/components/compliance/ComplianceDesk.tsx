"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Briefcase, CalendarDays, CircleAlert, FileWarning, Plus, ShieldAlert, ShieldCheck, ShieldX, Star } from "lucide-react";
import { Button, ButtonLink, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ComplianceCalendar, todayYmd, type CalendarEvent } from "@/components/workspace/Calendar";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { compliance, opsError, type ComplianceBoard, type Obligation, type Occurrence } from "@/lib/api/operations-compliance-client";
import { CertificateRibbon } from "./CertificateRibbon";
import { ObligationDialog } from "./ObligationDialog";
import { StageChip } from "./parts";
import { categoryHue, dueRuleText, dueText, nextOpen, stageMeta, stageToEvent, windowAround } from "./labels";

/**
 * The compliance desk: what falls due in the next month, what is late, which
 * certificates have lapsed or are about to; one calendar for everybody's
 * deadlines (Finance's remittances included) filtered by who owns them; the
 * certificates on one time axis; and the register itself.
 */
/** The register as listed, with each obligation's next open deadline, for a spreadsheet. Exported for testing. */
export function obligationRows(rows: Obligation[], next: Map<string, Occurrence>, frequencies: Record<string, string>) {
  return [
    ["Obligation", "Authority", "Category", "Owner", "Frequency", "Due rule", "Next due", "Next period", "Next stage", "Certificate", "Mandatory", "In bid pack", "Needs payment", "Typical fee", "Currency", "Evidence required", "Reminders (days before)", "Active"],
    ...rows.map((o) => {
      const n = next.get(o.id);
      return [
        o.name,
        o.authority ?? "",
        o.categoryLabel,
        o.owner ?? o.ownerRole ?? "",
        frequencies[o.frequency] ?? o.frequency,
        dueRuleText(o.dueRule, o.frequency),
        csvDate(n?.dueOn),
        n?.period ?? "",
        n ? stageMeta(n.stage).label : "",
        o.isCertificate ? "Yes" : "No",
        o.mandatory ? "Yes" : "No",
        o.bidPack ? "Yes" : "No",
        o.needsPayment ? "Yes" : "No",
        csvAmount(o.typicalFee),
        o.typicalFee === null ? "" : "NGN",
        o.evidenceRequired ?? "",
        o.reminderDays.join(" "),
        o.active ? "Yes" : "Paused",
      ];
    }),
  ];
}

export default function ComplianceDesk() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [range, setRange] = useState(() => windowAround(now.getFullYear(), now.getMonth()));
  const [board, setBoard] = useState<ComplianceBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [owner, setOwner] = useState("");
  const [adding, setAdding] = useState(false);
  const listView = useListView("ops-compliance-register");
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    compliance.board(range).then(
      (b) => {
        if (!alive) return;
        setBoard(b);
        setError(null);
      },
      (e: unknown) => alive && setError(`The compliance register didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [range, reload]);

  /** Move the month; past the loaded window, load the window around it. */
  const go = (delta: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      const next = { y: d.getFullYear(), m: d.getMonth() };
      const first = `${next.y}-${String(next.m + 1).padStart(2, "0")}-01`;
      if (first < range.from || first > range.to) setRange(windowAround(next.y, next.m));
      return next;
    });

  const occurrences = useMemo(() => (board?.occurrences ?? []).filter((o) => o.stage !== "cancelled" && (!owner || o.ownerRole === owner)), [board, owner]);

  const events: CalendarEvent[] = useMemo(
    () =>
      occurrences
        .filter((o) => o.dueOn)
        .map((o) => ({
          id: o.id,
          date: o.dueOn as string,
          title: `${o.name ?? "Obligation"}${o.period ? ` (${o.period})` : ""}`,
          meta: [stageMeta(o.stage).label, o.ownerRole].filter(Boolean).join(" · "),
          hue: categoryHue(o.category),
          status: stageToEvent(o.stage),
          kind: o.category ?? undefined,
          allDay: true,
          href: `/suite/operations/compliance/${o.id}`,
        })),
    [occurrences],
  );

  if (error && !board) {
    return (
      <div>
        <PageHeader title="Compliance" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!board) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the compliance register…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[480px]" />
      </div>
    );
  }

  const s = board.summary;
  const can = (a: string) => mayDoOps(user, "compliance", a);
  const next = nextOpen(board.occurrences);
  const obligations = board.obligations.filter((o) => !owner || o.ownerRole === owner);

  const columns: Column<Obligation>[] = [
    {
      key: "name",
      header: "Obligation",
      primary: true,
      sortable: true,
      value: (o) => `${o.name} ${o.authority ?? ""}`,
      render: (o) => (
        <span className="block min-w-0">
          <span className={cx("block truncate font-semibold", o.active ? "text-neutral-900" : "text-neutral-500")}>
            {o.name}
            {!o.active && <span className="ml-2 text-xs font-medium text-neutral-500">(paused)</span>}
          </span>
          <span className="block truncate text-xs text-neutral-500">{o.authority ?? "-"}</span>
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      hideOnMobile: true,
      value: (o) => o.categoryLabel,
      render: (o) => (
        <Chip hue={categoryHue(o.category)} dot>
          {o.categoryLabel}
        </Chip>
      ),
    },
    { key: "owner", header: "Owner", sortable: true, value: (o) => o.owner ?? o.ownerRole ?? "", render: (o) => <span className="text-neutral-700">{o.owner ?? o.ownerRole ?? "-"}</span> },
    {
      key: "frequency",
      header: "Frequency",
      sortable: true,
      hideOnMobile: true,
      value: (o) => board.frequencies[o.frequency] ?? o.frequency,
      render: (o) => (
        <span className="block min-w-0">
          <span className="block text-neutral-800">{board.frequencies[o.frequency] ?? o.frequency}</span>
          <span className="block truncate text-xs text-neutral-500">{dueRuleText(o.dueRule, o.frequency)}</span>
        </span>
      ),
    },
    {
      key: "next",
      header: "Next due",
      sortable: true,
      value: (o) => next.get(o.id)?.dueOn ?? "9999",
      render: (o) => {
        const n = next.get(o.id);
        if (!n?.dueOn) return <span className="text-neutral-500">-</span>;
        return (
          <span className="block whitespace-nowrap">
            <span className="block font-medium tabular-nums text-neutral-900">{day(n.dueOn)}</span>
            <span className={cx("block text-xs", n.stage === "overdue" ? "font-semibold text-rose-700" : "text-neutral-500")}>{dueText(n.dueOn, today, n.stage)}</span>
          </span>
        );
      },
    },
    {
      key: "stage",
      header: "Stage",
      sortable: true,
      value: (o) => stageMeta(next.get(o.id)?.stage).label,
      render: (o) => {
        const n = next.get(o.id);
        return n ? <StageChip stage={n.stage} /> : <Chip>Nothing open</Chip>;
      },
    },
    {
      key: "flags",
      header: "Marks",
      tableOnly: true,
      hideOnMobile: true,
      render: (o) => (
        <span className="flex items-center gap-1.5 text-neutral-400">
          {o.mandatory && <Star size={14} className="fill-neutral-300" aria-label="Mandatory" />}
          {o.isCertificate && <ShieldCheck size={14} aria-label="Certificate" />}
          {o.bidPack && <Briefcase size={14} aria-label="In the bid pack" />}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Compliance"
        subtitle="Statutory filings, remittances and certificates: what is due, what is late, and what lapses next."
        actions={
          <>
            <ButtonLink href="/suite/operations/compliance/bid-pack" icon={Briefcase}>
              Bid-readiness pack
            </ButtonLink>
            {can("create") && (
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add obligation
              </Button>
            )}
          </>
        }
      />

      {s.expiredMandatory.length > 0 && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-error-500/20 bg-error-500/5 px-4 py-3.5 text-sm text-error-700">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-error-600 shadow-sm">
            <ShieldX size={18} aria-hidden />
          </span>
          <p>
            <span className="block font-semibold">
              {s.expiredMandatory.length === 1 ? "A mandatory certificate has expired" : `${s.expiredMandatory.length} mandatory certificates have expired`}
            </span>
            {s.expiredMandatory.join(", ")}. Renew {s.expiredMandatory.length === 1 ? "it" : "them"} before the next bid or statutory check.
          </p>
        </div>
      )}

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Due in the next 30 days" value={s.dueSoon} icon={AlarmClock} hint={s.dueSoon ? "Open, not yet submitted" : "Nothing falls due this month"} />
          <StatCard label="Overdue" value={s.overdue} icon={CircleAlert} hue={s.overdue ? "rose" : "mint"} hint={s.overdue ? "Past the due date and still open" : "Nothing late"} />
          <StatCard
            label="Expired certificates"
            value={s.expired}
            icon={ShieldX}
            hue={s.expired ? "rose" : "mint"}
            hint={s.expiredMandatory.length ? `${s.expiredMandatory.length} of them mandatory` : s.expired ? "None of them mandatory" : "Every certificate is current"}
          />
          <StatCard label="Expiring in 60 days" value={s.expiring} icon={ShieldAlert} hue={s.expiring ? "sun" : "slate"} hint="Start the renewal now" />
        </StatGrid>

        <Panel
          title="Deadlines"
          subtitle="Every team's filings and renewals on one calendar, Finance's tax remittances included."
          icon={CalendarDays}
          hue="blue"
        >
          {board.owners.length > 0 && (
            <div role="radiogroup" aria-label="Whose deadlines" className="mb-4 flex flex-wrap gap-2">
              {["", ...board.owners].map((o) => {
                const on = owner === o;
                return (
                  <button
                    key={o || "everyone"}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setOwner(o)}
                    className={cx(
                      "min-h-10 cursor-pointer rounded-full px-4 text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                      on ? "bg-primary-600 text-white shadow-sm" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900",
                    )}
                  >
                    {o || "Everyone"}
                    <span className={cx("ml-1.5 tabular-nums", on ? "text-white/80" : "text-neutral-500")}>
                      {(board.occurrences ?? []).filter((x) => x.stage !== "completed" && x.stage !== "cancelled" && (!o || x.ownerRole === o)).length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <ComplianceCalendar year={month.y} month={month.m} events={events} onPrev={() => go(-1)} onNext={() => go(1)} />
        </Panel>

        <Panel
          title="Certificate validity"
          subtitle="Each certificate from the day it was issued to the day it lapses. Renew the ones with least time left first."
          icon={ShieldCheck}
          hue="mint"
          actions={
            <ButtonLink href="/suite/operations/compliance/bid-pack" size="sm" icon={Briefcase}>
              Bid pack
            </ButtonLink>
          }
        >
          <CertificateRibbon
            certificates={board.certificates}
            today={today}
            hrefFor={(c) => {
              const open = next.get(c.obligationId);
              return open ? `/suite/operations/compliance/${open.id}` : c.occurrenceId ? `/suite/operations/compliance/${c.occurrenceId}` : null;
            }}
          />
        </Panel>

        <section aria-labelledby="register-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="register-heading" className="text-base font-bold tracking-tight text-neutral-900">
                The register
              </h2>
              <p className="text-xs text-neutral-500">
                {board.obligations.length} {board.obligations.length === 1 ? "obligation" : "obligations"}
                {owner ? ` · showing ${owner}` : ""}. Open one to work its next deadline.
              </p>
            </div>
          </div>
          <DataView
            rows={obligations}
            columns={columns}
            rowKey={(o) => o.id}
            rowHref={(o) => {
              const n = next.get(o.id);
              return n ? `/suite/operations/compliance/${n.id}` : null;
            }}
            {...listView}
            searchPlaceholder="Search obligations or authorities"
            caption="The compliance register"
            onDownload={(r) => downloadCsv(`compliance-register${owner ? `_${owner}` : ""}.csv`, obligationRows(r, next, board.frequencies))}
            gridCols={3}
            renderCard={(o) => <ObligationCard o={o} next={next.get(o.id)} frequency={board.frequencies[o.frequency] ?? o.frequency} today={today} />}
            empty={
              owner ? (
                <Empty icon={FileWarning} hue="slate" title={`Nothing on the register is owned by ${owner}`} hint="Choose Everyone to see the whole register." />
              ) : (
                <Empty icon={FileWarning} hue="slate" title="The register is empty" hint="Add your first obligation." />
              )
            }
          />
        </section>
      </div>

      {adding && (
        <ObligationDialog
          categories={board.categories}
          frequencies={board.frequencies}
          owners={board.owners}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function ObligationCard({ o, next, frequency, today }: { o: Obligation; next: Occurrence | undefined; frequency: string; today: string }) {
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <Chip hue={categoryHue(o.category)} dot>
          {o.categoryLabel}
        </Chip>
        {next ? <StageChip stage={next.stage} /> : <Chip>Nothing open</Chip>}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[15px] font-semibold text-neutral-900">{o.name}</p>
        <p className="truncate text-xs text-neutral-500">{[o.authority, o.owner ?? o.ownerRole].filter(Boolean).join(" · ") || "-"}</p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-sm">
        <span className="text-neutral-600">{frequency}</span>
        {next?.dueOn ? (
          <span className={cx("font-semibold tabular-nums", next.stage === "overdue" ? "text-rose-700" : "text-neutral-900")}>{dueText(next.dueOn, today, next.stage)}</span>
        ) : (
          <span className="text-neutral-500">-</span>
        )}
      </div>
    </div>
  );
}
