"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlarmClock, BookOpenCheck, CircleCheck, Headset, Inbox, Smile, Star, UserX } from "lucide-react";
import { ButtonLink, Chip, Empty, PageHeader, Panel, PriorityChip, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Donut, SegmentedGauge } from "@/components/workspace/charts";
import { FaceAvatar, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { downloadCsv } from "@/components/workspace/csv";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { desk, opsError, type DeskQueue, type Ticket } from "@/lib/api/operations-desk-client";
import { ChipFilter } from "@/suite/operations/components/facilities/parts";
import { CategoryIcon, SlaPill, TicketStatusChip } from "./parts";
import { ago, categoryLook, queueOrder, sla, statusMeta, useNow } from "./labels";

const PRIORITY_LABEL: Record<string, string> = { critical: "Critical", high: "High", normal: "Normal", low: "Low" };

/** The tickets as listed, for a spreadsheet. Exported for testing. */
export function ticketRows(rows: Ticket[], categoryLabel: (c: string) => string = (c) => c) {
  return [
    ["Number", "Title", "Item", "Category", "Priority", "Status", "Asked by", "With", "Raised at", "SLA due at", "Past SLA", "Resolved at", "Rating"],
    ...rows.map((t) => [
      t.number ?? "",
      t.title,
      t.item ?? "",
      categoryLabel(t.category ?? "other"),
      PRIORITY_LABEL[t.priority] ?? t.priority,
      statusMeta(t.status).label,
      t.requester ?? "",
      t.assignee ?? "Unassigned",
      t.createdAt ?? "",
      t.slaDueAt ?? "",
      t.breached ? "Yes" : "No",
      t.resolvedAt ?? "",
      t.rating ?? "",
    ]),
  ];
}

type StatusFilter = "open" | "waiting" | "resolved" | "closed" | "all";

/**
 * The service desk queue: how many are open, breached and unassigned, how
 * happy people are and how often the SLA is met; then every ticket, the
 * most urgent first, each with its SLA clock counting down live.
 */
export default function ServiceDesk() {
  const { user } = useAuth();
  const now = useNow();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [mine, setMine] = useState<"all" | "mine">("all");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState<DeskQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const listView = useListView("ops-service-desk");

  useEffect(() => {
    let alive = true;
    desk.queue({ status, mine: mine === "mine" }).then(
      (r) => {
        if (!alive) return;
        setQ(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`The queue didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [status, mine, reload]);

  const rows = useMemo(() => [...(q?.tickets ?? [])].filter((t) => !category || (t.category ?? "other") === category).sort(queueOrder), [q, category]);

  if (error && !q) {
    return (
      <div>
        <PageHeader title="Service desk" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!q) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the queue…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const s = q.summary;
  const label = (c: string) => q.categories[c] ?? c;
  const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  const attention = (q.tickets ?? []).filter((t) => statusMeta(t.status).open && (t.breached || !t.assigneeId)).sort(queueOrder).slice(0, 5);

  const columns: Column<Ticket>[] = [
    {
      key: "title",
      header: "Ticket",
      primary: true,
      sortable: true,
      value: (t) => `${t.number ?? ""} ${t.title} ${t.item ?? ""}`,
      render: (t) => (
        <span className="flex min-w-0 items-center gap-3">
          <CategoryIcon category={t.category} size={34} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{t.title}</span>
            <span className="block truncate text-xs text-neutral-500">
              <span className="font-mono">{t.number}</span>
              {t.item ? ` · ${t.item}` : ""}
            </span>
          </span>
        </span>
      ),
    },
    { key: "priority", header: "Priority", sortable: true, value: (t) => ({ critical: 0, high: 1, normal: 2, low: 3 })[t.priority] ?? 9, render: (t) => <PriorityChip priority={t.priority} /> },
    {
      key: "sla",
      header: "SLA",
      sortable: true,
      value: (t) => sla(t, now).ms,
      render: (t) => <SlaPill ticket={t} now={now} />,
    },
    {
      key: "requester",
      header: "Asked by",
      sortable: true,
      hideOnMobile: true,
      value: (t) => t.requester ?? "",
      render: (t) => (
        <span className="block min-w-0">
          <span className="block truncate text-neutral-800">{t.requester ?? "-"}</span>
          <span className="block text-xs text-neutral-500">{ago(t.createdAt, now)}</span>
        </span>
      ),
    },
    {
      key: "assignee",
      header: "With",
      sortable: true,
      value: (t) => t.assignee ?? "",
      render: (t) =>
        t.assignee ? (
          <span className="flex items-center gap-2">
            <FaceAvatar name={t.assignee} size={24} />
            <span className="truncate text-neutral-800">{t.assignee}</span>
          </span>
        ) : (
          <Chip hue="coral">Unassigned</Chip>
        ),
    },
    { key: "status", header: "Status", sortable: true, value: (t) => statusMeta(t.status).label, render: (t) => <TicketStatusChip status={t.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Service desk"
        subtitle="Everything staff have asked for: the most urgent first, each against its SLA."
        actions={
          mayDoOps(user, "service_desk", "view") && (
            <ButtonLink href="/suite/operations/desk/catalogue" icon={BookOpenCheck}>
              Request catalogue
            </ButtonLink>
          )
        }
      />

      <div className="space-y-5">
        <StatGrid cols={5}>
          <StatCard featured label="Open" value={s.open} icon={Inbox} hint={`${s.resolvedThisWeek} resolved this week`} />
          <StatCard label="SLA breached" value={s.breached} icon={AlarmClock} hue={s.breached ? "rose" : "mint"} hint={s.breached ? "Open and past the clock" : "Nothing late"} />
          <StatCard label="Unassigned" value={s.unassigned} icon={UserX} hue={s.unassigned ? "coral" : "mint"} hint={s.unassigned ? "Nobody has picked them up" : "Everything has an owner"} />
          <StatCard label="Satisfaction" value={s.satisfaction ?? "-"} unit={s.satisfaction !== null ? "of 5" : undefined} icon={Smile} hue="sun" hint={s.satisfaction !== null ? "Average rating at close" : "Nobody has rated yet"} />
          <StatCard label="SLA met" value={s.slaMet !== null ? `${s.slaMet}%` : "-"} icon={CircleCheck} hue="mint" hint="Resolved inside the clock, six months" />
        </StatGrid>

        <div className="grid gap-5 lg:grid-cols-3">
          <Panel title="Open by category" icon={Headset} hue="blue" subtitle="What people are asking for now.">
            {cats.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">Nothing open.</p>
            ) : (
              <Donut
                data={cats.map(([c, n]) => ({ label: label(c), value: n, hue: categoryLook(c).hue }))}
                total={s.open}
                centerLabel="open"
                size={160}
                legend="below"
                caption="Open tickets by category"
              />
            )}
          </Panel>
          <Panel title="Needs attention" icon={AlarmClock} hue="rose" subtitle="Breached or unassigned, most urgent first." className="lg:col-span-2">
            {attention.length === 0 ? (
              <Empty icon={Star} hue="mint" title="Nothing needs attention" hint="Every open ticket is inside its SLA and has someone on it." />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {attention.map((t) => (
                  <li key={t.id}>
                    <Link href={`/suite/operations/desk/${t.id}`} className="flex flex-wrap items-center gap-3 rounded-xl py-3 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300 sm:flex-nowrap sm:px-2">
                      <CategoryIcon category={t.category} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-900">{t.title}</span>
                        <span className="block truncate text-xs text-neutral-500">
                          {t.number} · {t.requester ?? "-"}
                        </span>
                      </span>
                      <PriorityChip priority={t.priority} />
                      {!t.assigneeId && <Chip hue="coral">Unassigned</Chip>}
                      <SlaPill ticket={t} now={now} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {s.slaMet !== null && (
              <div className="mt-4 hidden border-t border-neutral-100 pt-4 sm:block">
                <SegmentedGauge value={s.slaMet} hue={s.slaMet >= 90 ? "mint" : s.slaMet >= 75 ? "sun" : "rose"} label="SLA met" size={180} caption="Resolved inside the SLA over six months" />
              </div>
            )}
          </Panel>
        </div>

        <section aria-labelledby="queue-h" className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="queue-h" className="text-[15px] font-semibold text-neutral-900">
                The queue
              </h2>
              <p className="text-xs text-neutral-500">Priority, then whichever SLA runs out first.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="Whose tickets"
                value={mine}
                onChange={setMine}
                options={[
                  { key: "all", label: "Everyone's" },
                  { key: "mine", label: "Assigned to me" },
                ]}
              />
              <Segmented
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { key: "open", label: "Open" },
                  { key: "waiting", label: "Waiting" },
                  { key: "resolved", label: "Resolved" },
                  { key: "closed", label: "Closed" },
                  { key: "all", label: "All" },
                ]}
              />
            </div>
          </div>
          <ChipFilter
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { key: "", label: "Every category", count: q.tickets.length },
              ...Object.keys(q.categories)
                .filter((c) => q.tickets.some((t) => (t.category ?? "other") === c))
                .map((c) => ({ key: c, label: label(c), count: q.tickets.filter((t) => (t.category ?? "other") === c).length })),
            ]}
          />
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(t) => t.id}
            rowHref={(t) => `/suite/operations/desk/${t.id}`}
            {...listView}
            searchPlaceholder="Search tickets, people or numbers"
            caption="The service desk queue"
            onDownload={(r) => downloadCsv(`service-desk_${status}${mine === "mine" ? "_mine" : ""}${category ? `_${category}` : ""}.csv`, ticketRows(r, label))}
            renderCard={(t) => (
              <div className={cx("flex h-full flex-col gap-3 p-5", t.breached && "bg-rose-50/40")}>
                <div className="flex items-start justify-between gap-2">
                  <CategoryIcon category={t.category} size={36} />
                  <PriorityChip priority={t.priority} />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[15px] font-semibold text-neutral-900">{t.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {t.number} · {t.requester ?? "-"}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <TicketStatusChip status={t.status} />
                  <SlaPill ticket={t} now={now} />
                </div>
              </div>
            )}
            empty={
              <div className="px-5 py-10 text-center text-sm text-neutral-500">
                <Inbox size={18} className="mx-auto mb-2 text-neutral-400" aria-hidden />
                {status === "open" ? "Nothing open. The queue is clear." : "No tickets match."}
              </div>
            }
          />
        </section>
      </div>
    </div>
  );
}
