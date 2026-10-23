"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleDollarSign, Hourglass, ReceiptText, ShieldAlert, Wallet } from "lucide-react";
import { ButtonLink, Card, Empty, PageHeader, Panel, Segmented, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { StatusBars } from "@/components/workspace/charts";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import type { Hue } from "@/components/workspace/modules";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { spend, spendError, type MemoStatus, type MemoSummary } from "@/lib/api/finance-spend-client";
import { mayUseFinance } from "@/suite/finance/lib/finance-access";
import { amount, compact, day } from "@/suite/finance/lib/format";
import { useLookup } from "@/suite/finance/components/banking/lookups";
import { Money } from "@/suite/finance/components/banking/ui";
import { MemoStatusChip } from "@/suite/finance/components/requests/ui";
import { MEMO_STATUS, MEMO_STATUS_ORDER, memoType } from "@/suite/finance/components/requests/labels";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";

/**
 * The memo register: every payment and advance request in the organisation,
 * whatever its state, with what has been asked, approved and paid.
 */

type TypeFilter = "all" | "payment" | "advance";

/** Where the money is, by stage, for the bar chart. */
const STAGES: { label: string; hue: Hue; statuses: MemoStatus[] }[] = [
  { label: "Drafts", hue: "slate", statuses: ["draft"] },
  { label: "In approval", hue: "grape", statuses: ["in_approval"] },
  { label: "With the FCU", hue: "sky", statuses: ["awaiting_fcu", "fcu_queried"] },
  { label: "Cleared, to be paid", hue: "blue", statuses: ["fcu_cleared", "partially_paid"] },
  { label: "Paid or retired", hue: "mint", statuses: ["paid", "awaiting_retirement", "retired", "closed"] },
];

const STATUS_OPTIONS: SelectOption[] = MEMO_STATUS_ORDER.map((s) => ({ value: s, label: MEMO_STATUS[s].label }));

export default function MemoRegister() {
  const { user } = useAuth();
  const allowed = mayUseFinance(user, "memos");
  const [loaded, setLoaded] = useState<{ key: string; rows: MemoSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [projectId, setProjectId] = useState("");
  const projects = useLookup("projects");

  /* Rows belong to the filters they were loaded for; new filters read as loading. */
  const filterKey = `${status}|${type}|${projectId}|${reload}`;
  const rows = loaded?.key === filterKey ? loaded.rows : null;

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    spend.memos
      .list({ status: status || undefined, type: type === "all" ? undefined : type, projectId: projectId || undefined })
      .then((r) => {
        if (!alive) return;
        setLoaded({ key: filterKey, rows: r });
        setError(null);
      })
      .catch((e: unknown) => alive && setError(`The register didn't load. ${spendError(e)}`));
    return () => {
      alive = false;
    };
  }, [allowed, status, type, projectId, filterKey]);

  const totals = useMemo(() => {
    const r = rows ?? [];
    return {
      asked: r.reduce((s, m) => s + m.amount, 0),
      approved: r.reduce((s, m) => s + (m.approvedAmount ?? 0), 0),
      paid: r.reduce((s, m) => s + m.paidAmount, 0),
      toPay: r.filter((m) => m.status === "fcu_cleared" || m.status === "partially_paid").reduce((s, m) => s + m.balance, 0),
      withFcu: r.filter((m) => m.status === "awaiting_fcu" || m.status === "fcu_queried").length,
      overridden: r.filter((m) => m.overridden).length,
    };
  }, [rows]);

  const byStage = useMemo(
    () =>
      STAGES.map((st) => {
        const inStage = (rows ?? []).filter((m) => st.statuses.includes(m.status));
        return { label: st.label, hue: st.hue, value: inStage.reduce((s, m) => s + (m.approvedAmount ?? m.amount), 0), note: `${inStage.length}` };
      }),
    [rows],
  );

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Memo register" />
        <Card>
          <Empty
            icon={ShieldAlert}
            title="The memo register is Finance's"
            hint="Your own payment and advance requests are under My requests."
            action={<ButtonLink href="/suite/finance/requests">Open my requests</ButtonLink>}
          />
        </Card>
      </div>
    );
  }

  const columns: Column<MemoSummary>[] = [
    {
      key: "title",
      header: "Request",
      primary: true,
      sortable: true,
      value: (m) => `${m.reference ?? ""} ${m.title} ${m.requester ?? ""}`,
      render: (m) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{m.title}</span>
          <span className="block text-xs text-neutral-500">
            {m.reference ?? "Draft"} · {m.requester ?? "-"}
          </span>
        </span>
      ),
    },
    { key: "type", header: "Type", sortable: true, value: (m) => memoType(m.type) },
    { key: "charged", header: "Charged to", sortable: true, hideOnMobile: true, value: (m) => m.project ?? m.costCentre ?? "" },
    { key: "amount", header: "Amount", align: "right", sortable: true, value: (m) => m.approvedAmount ?? m.amount, render: (m) => <Money value={m.approvedAmount ?? m.amount} currency={m.currency ?? "NGN"} className="font-semibold" /> },
    { key: "paid", header: "Paid", align: "right", sortable: true, hideOnMobile: true, value: (m) => m.paidAmount, render: (m) => <Money value={m.paidAmount} currency={m.currency ?? "NGN"} /> },
    { key: "status", header: "Status", sortable: true, value: (m) => MEMO_STATUS[m.status]?.label ?? m.status, render: (m) => <MemoStatusChip status={m.status} /> },
    { key: "sent", header: "Sent", sortable: true, hideOnMobile: true, value: (m) => m.submittedAt ?? "", render: (m) => (m.submittedAt ? day(m.submittedAt) : "-") },
  ];

  /* What is listed - the filters, the search and the sort - as a spreadsheet. */
  const exportCsv = (shown: MemoSummary[]) =>
    downloadCsv(`memo-register${type === "all" ? "" : `_${type}`}${status ? `_${status}` : ""}.csv`, [
      ["Reference", "Title", "Type", "Requester", "Charged to", "Currency", "Amount", "Approved", "Paid", "Balance", "Status", "Sent"],
      ...shown.map((m) => [
        m.reference ?? "",
        m.title,
        memoType(m.type),
        m.requester ?? "",
        m.project ?? m.costCentre ?? "",
        m.currency ?? "NGN",
        csvAmount(m.amount),
        csvAmount(m.approvedAmount),
        csvAmount(m.paidAmount),
        csvAmount(m.balance),
        MEMO_STATUS[m.status]?.label ?? m.status,
        csvDate(m.submittedAt),
      ]),
    ]);

  return (
    <div>
      <PageHeader title="Memo register" subtitle="Every payment and advance request in the organisation, and where each one is." />

      <StatGrid>
        <StatCard featured label="Approved" value={compact(totals.approved)} icon={BadgeCheck} hint={`${amount(totals.asked)} asked for`} />
        <StatCard label="Paid" value={compact(totals.paid)} icon={Wallet} hue="mint" hint={amount(totals.paid)} />
        <StatCard label="Cleared, still to pay" value={compact(totals.toPay)} icon={CircleDollarSign} hue="blue" hint={amount(totals.toPay)} />
        <StatCard label="With the FCU" value={totals.withFcu} icon={Hourglass} hue="sky" hint={totals.overridden ? `${totals.overridden} sent beyond funds` : "None beyond funds"} />
      </StatGrid>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {error && rows === null ? (
            <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />
          ) : rows === null ? (
            <Skeleton className="h-[420px]" />
          ) : (
            <DataView
              rows={rows}
              columns={columns}
              rowKey={(m) => m.id}
              rowHref={(m) => `/suite/finance/memos/${m.id}`}
              storageKey="finance-memo-register"
              searchPlaceholder="Search by title, reference or person"
              caption="Payment and advance requests"
              onDownload={exportCsv}
              toolbar={
                <>
                  <Segmented
                    label="Type"
                    value={type}
                    onChange={setType}
                    options={[
                      { key: "all", label: "All" },
                      { key: "payment", label: "Payments" },
                      { key: "advance", label: "Advances" },
                    ]}
                  />
                  <SearchableSelect size="sm" aria-label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} clearable clearLabel="Any status" placeholder="Any status" className="w-44" searchPlaceholder="Search statuses" />
                  <SearchableSelect
                    size="sm"
                    aria-label="Project"
                    value={projectId}
                    onChange={setProjectId}
                    options={projects.options}
                    clearable
                    clearLabel="Any project"
                    placeholder="Any project"
                    className="w-48"
                    searchPlaceholder="Search projects"
                  />
                </>
              }
              empty={<Empty icon={ReceiptText} title="No requests match" hint="Clear a filter to see more." />}
            />
          )}
        </div>
        <Panel title="Where the money is" subtitle="Approved value by stage, with the number of requests" icon={CircleDollarSign} hue="blue">
          {rows === null ? <Skeleton className="h-[220px]" /> : <StatusBars data={byStage} format={(v) => compact(v)} caption="Approved value of requests by stage" />}
        </Panel>
      </div>
    </div>
  );
}
