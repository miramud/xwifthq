"use client";

import { useEffect, useMemo, useState } from "react";
import { NotebookPen, Plus } from "lucide-react";
import { ButtonLink, Chip, Empty, PageHeader, type PageTab } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { MEMO_CATEGORIES, formatMoney, memos, type MemoStatus, type MemoSummary } from "@/lib/api/approvals-client";
import { MEMO_STATUS, formatDate } from "../lib/labels";

/*
  My memos: every memo I have written, by where it stands. A draft is still
  mine to change; a pending one is with its approvers; a returned one is back
  with me to fix and resend.
*/

type Filter = "all" | MemoStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "pending", label: "Waiting" },
  { key: "returned", label: "Returned" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "withdrawn", label: "Withdrawn" },
];

export default function MemosBoard() {
  const [rows, setRows] = useState<MemoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let alive = true;
    memos
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      })
      .catch(() => alive && setError("Your memos didn't load. Try again."));
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => (rows ?? []).filter((m) => filter === "all" || m.status === filter), [rows, filter]);

  const tabs: PageTab[] = FILTERS.map((f) => ({
    key: f.key,
    label: f.label,
    count: rows ? (f.key === "all" ? rows.length : rows.filter((m) => m.status === f.key).length) : undefined,
  }));

  const columns: Column<MemoSummary>[] = [
    {
      key: "title",
      header: "Memo",
      primary: true,
      sortable: true,
      value: (m) => `${m.title} ${m.reference ?? ""}`,
      render: (m) => (
        <span className="block min-w-[12rem]">
          <span className="block font-semibold text-neutral-900">{m.title}</span>
          <span className="block text-xs tabular-nums text-neutral-500">{m.reference ?? "Draft — no reference yet"}</span>
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      value: (m) => MEMO_CATEGORIES.find((c) => c.value === m.category)?.label ?? m.category,
      hideOnMobile: true,
    },
    { key: "unit", header: "Unit", value: (m) => m.unit?.name ?? "", hideOnMobile: true },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (m) => m.amount ?? undefined,
      render: (m) => (m.amount == null ? <span className="text-neutral-400">—</span> : formatMoney(m.amount, m.currency)),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (m) => MEMO_STATUS[m.status]?.label ?? m.status,
      render: (m) => (
        <Chip hue={MEMO_STATUS[m.status]?.hue ?? "slate"} dot>
          {MEMO_STATUS[m.status]?.label ?? m.status}
        </Chip>
      ),
    },
    {
      key: "updated",
      header: "Last change",
      sortable: true,
      value: (m) => m.decidedAt ?? m.submittedAt ?? m.updatedAt ?? undefined,
      render: (m) => formatDate(m.decidedAt ?? m.submittedAt ?? m.updatedAt),
    },
  ];

  return (
    <div>
      <PageHeader
        title="My memos"
        subtitle="Write a memo, send it for approval and follow it to a decision."
        actions={
          <ButtonLink href="/suite/memos/new" variant="primary" icon={Plus}>
            New memo
          </ButtonLink>
        }
        tabs={tabs}
        activeTab={filter}
        onTab={(k) => setFilter(k as Filter)}
      />

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      {rows === null && !error ? (
        <Skeleton className="h-64" />
      ) : (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(m) => m.id}
          rowHref={(m) => `/suite/memos/${m.id}`}
          storageKey="memos"
          searchPlaceholder="Search by title or reference"
          caption="My memos"
          empty={
            filter === "all" ? (
              <Empty
                icon={NotebookPen}
                title="You haven't written a memo yet"
                hint="Use a memo to ask for approval of anything without its own form — a policy change, an event, a contract award."
                action={
                  <ButtonLink href="/suite/memos/new" icon={Plus}>
                    Write a memo
                  </ButtonLink>
                }
              />
            ) : (
              <Empty icon={NotebookPen} title={`No memos in ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()}`} hint="Choose All to see every memo you have written." />
            )
          }
        />
      )}
    </div>
  );
}
