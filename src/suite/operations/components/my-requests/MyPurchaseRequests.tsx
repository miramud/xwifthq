"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePen, Hourglass, Plus, Scale, ShoppingCart } from "lucide-react";
import { ButtonLink, Card, Empty, PageHeader, Panel, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Donut } from "@/components/workspace/charts";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { RequestRoad } from "@/suite/finance/components/requests/ui";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { opsError, procurement, type PrSummary } from "@/lib/api/operations-procurement-client";
import { prRoad, prStatus } from "@/suite/operations/components/procurement/meta";
import { DocNo, PrStatusChip } from "@/suite/operations/components/procurement/ui";

/**
 * My purchase requests: what this person has asked to buy, where each one
 * is - draft, approval, sourcing, award, ordered - and the drafts still to
 * finish and send.
 */

type Tab = "all" | "drafts" | "moving" | "done";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "drafts", label: "Drafts" },
  { key: "moving", label: "On their way" },
  { key: "done", label: "Finished" },
];

const MOVING = ["in_approval", "approved", "award_pending", "awarded"];
const inTab = (p: PrSummary, t: Tab) =>
  t === "drafts" ? p.status === "draft" : t === "moving" ? MOVING.includes(p.status) : t === "done" ? ["ordered", "cancelled", "rejected"].includes(p.status) : true;

export default function MyPurchaseRequests() {
  const [rows, setRows] = useState<PrSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    let alive = true;
    procurement.me
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(`Your purchase requests didn't load. ${opsError(e)}`));
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((p) => inTab(p, t.key)).length])) as Record<Tab, number>;
  const moving = all.filter((p) => MOVING.includes(p.status));
  const year = String(new Date().getFullYear());
  const orderedThisYear = all.filter((p) => p.status === "ordered" && (p.createdAt ?? "").startsWith(year));

  const byStage = useMemo(() => {
    const groups = new Map<string, { label: string; value: number; hue: ReturnType<typeof prStatus>["hue"] }>();
    for (const p of all.filter((x) => MOVING.includes(x.status) || x.status === "draft")) {
      const s = prStatus(p.status);
      const g = groups.get(p.status) ?? { label: s.label, value: 0, hue: s.hue };
      g.value += 1;
      groups.set(p.status, g);
    }
    return [...groups.values()];
  }, [all]);

  const href = (p: PrSummary) => (p.status === "draft" ? `/suite/operations/my/requests/new?id=${p.id}` : `/suite/operations/my/requests/${p.id}`);

  const columns: Column<PrSummary>[] = [
    {
      key: "title",
      header: "Request",
      primary: true,
      sortable: true,
      value: (p) => `${p.title} ${p.number ?? ""}`,
      render: (p) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{p.title}</span>
          <span className="block text-xs text-neutral-500">
            {p.number ?? "Not sent yet"} · {p.categoryLabel}
          </span>
        </span>
      ),
    },
    { key: "estimate", header: "Estimate", align: "right", sortable: true, value: (p) => p.estimate, render: (p) => <Money value={p.estimate} currency={p.currency} className="font-semibold" /> },
    { key: "status", header: "Status", sortable: true, value: (p) => prStatus(p.status).label, render: (p) => <PrStatusChip status={p.status} /> },
    { key: "neededBy", header: "Needed by", sortable: true, hideOnMobile: true, value: (p) => p.neededBy ?? "", render: (p) => (p.neededBy ? day(p.neededBy) : "—") },
  ];

  return (
    <div>
      <PageHeader
        title="My purchase requests"
        subtitle="What you have asked the organisation to buy, and where each request is."
        actions={
          <ButtonLink href="/suite/operations/my/requests/new" variant="primary" icon={Plus}>
            New purchase request
          </ButtonLink>
        }
        tabs={rows && rows.length > 0 ? TABS.map((t) => ({ ...t, count: counts[t.key] })) : undefined}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {error && rows === null && <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />}

      {rows === null && !error && (
        <div aria-busy="true" className="space-y-5">
          <p className="sr-only">Loading your purchase requests…</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[132px]" />
            ))}
          </div>
          <Skeleton className="h-[320px]" />
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <Card>
          <Empty
            icon={ShoppingCart}
            title="Ask the organisation to buy something"
            hint="A purchase request says what is needed, roughly what it costs and which budget pays. Once approved, procurement gets the quotations and raises the order. Follow it here until it arrives."
            action={
              <ButtonLink href="/suite/operations/my/requests/new" variant="primary" icon={Plus}>
                Raise your first request
              </ButtonLink>
            }
          />
        </Card>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="space-y-5">
          <StatGrid>
            <StatCard featured label="Drafts to send" value={counts.drafts} icon={FilePen} hint={counts.drafts ? "Finish and send them" : "Nothing waiting on you"} />
            <StatCard label="On their way" value={moving.length} icon={Hourglass} hue="grape" hint={`${compact(moving.reduce((s, p) => s + p.estimate, 0))} estimated`} />
            <StatCard label="Being sourced" value={all.filter((p) => p.status === "approved" || p.status === "award_pending").length} icon={Scale} hue="sky" hint="Quotations being gathered" />
            <StatCard label="Ordered this year" value={orderedThisYear.length} icon={ShoppingCart} hue="mint" hint={compact(orderedThisYear.reduce((s, p) => s + p.estimate, 0))} />
          </StatGrid>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <DataView
                rows={all.filter((p) => inTab(p, tab))}
                columns={columns}
                rowKey={(p) => p.id}
                rowHref={href}
                storageKey="ops-my-requests"
                defaultView="list"
                views={["list", "table"]}
                searchPlaceholder="Search your requests"
                caption="Your purchase requests"
                renderListItem={(p) => <RequestCard pr={p} />}
                empty={<p className="px-5 py-10 text-center text-sm text-neutral-500">Nothing here. Try another tab.</p>}
              />
            </div>
            <Panel title="Where they are" subtitle="Drafts and requests on their way" icon={Hourglass} hue="grape">
              {byStage.length === 0 ? (
                <p className="text-sm text-neutral-500">Everything you asked for has been ordered or closed.</p>
              ) : (
                <Donut data={byStage} total={byStage.reduce((s, g) => s + g.value, 0)} centerLabel="open" size={160} legend="below" caption="Your open purchase requests by stage" />
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ pr: p }: { pr: PrSummary }) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{p.title}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            <DocNo value={p.number ?? "Not sent yet"} /> · {p.categoryLabel}
            {p.project ? ` · ${p.project.name}` : ""}
          </p>
        </div>
        <Money value={p.estimate} currency={p.currency} className="shrink-0 text-[15px] font-bold text-neutral-900" />
      </div>
      <div className="mt-3">
        <RequestRoad stage={{ ...prRoad(p.status), flagged: false }} compact />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <PrStatusChip status={p.status} />
        {p.neededBy && <span className="text-xs text-neutral-500">Needed by {day(p.neededBy)}</span>}
      </div>
    </div>
  );
}
