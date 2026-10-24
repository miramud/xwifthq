"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCheck, BookOpenCheck, CalendarClock, FolderArchive, PenLine, Plus } from "lucide-react";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Progress, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { day } from "@/suite/finance/lib/format";
import { repoError, repository, type ControlledRow } from "@/lib/api/repository-client";
import { ControlledDialog } from "./ControlledDialogs";
import { VersionChip } from "./parts";

/**
 * Policies, SOPs, templates and forms under version control: which version
 * is in force, when it is next reviewed, and how many of the people it is
 * for have read it.
 */

export const readPercent = (r: Pick<ControlledRow, "current">): number | null =>
  r.current && r.current.assigned > 0 ? Math.round((r.current.acknowledged / r.current.assigned) * 100) : null;

export default function ControlledList() {
  const router = useRouter();
  const [data, setData] = useState<{ documents: ControlledRow[]; kinds: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const listView = useListView("ops-controlled-documents");

  useEffect(() => {
    let alive = true;
    repository.controlled.list().then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Controlled documents didn't load. ${repoError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Policies and SOPs" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading controlled documents…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const docs = data.documents;
  const inForce = docs.filter((d) => d.current).length;
  const reviewDue = docs.filter((d) => d.reviewDue).length;
  const revising = docs.filter((d) => d.inProgress).length;
  const assigned = docs.reduce((s, d) => s + (d.current?.assigned ?? 0), 0);
  const acknowledged = docs.reduce((s, d) => s + (d.current?.acknowledged ?? 0), 0);
  const readAll = assigned > 0 ? Math.round((acknowledged / assigned) * 100) : null;

  const columns: Column<ControlledRow>[] = [
    { key: "code", header: "Code", sortable: true, value: (d) => d.code, render: (d) => <span className="font-mono text-xs font-semibold text-neutral-800">{d.code}</span>, tableOnly: true },
    {
      key: "title",
      header: "Document",
      primary: true,
      sortable: true,
      value: (d) => `${d.code} ${d.title}`,
      render: (d) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{d.title}</span>
          <span className="block truncate text-xs text-neutral-500">{[d.kindLabel, d.ownerUnit ?? d.owner].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    {
      key: "version",
      header: "In force",
      sortable: true,
      value: (d) => d.current?.version ?? "",
      render: (d) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {d.current ? <span className="font-mono text-sm font-semibold text-neutral-900">v{d.current.version}</span> : <span className="text-neutral-500">None yet</span>}
          {d.inProgress && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              <PenLine size={12} aria-hidden />v{d.inProgress.version} <VersionChip status={d.inProgress.status} />
            </span>
          )}
        </span>
      ),
    },
    { key: "effective", header: "Effective", sortable: true, hideOnMobile: true, value: (d) => d.current?.effectiveOn ?? "", render: (d) => <span className="tabular-nums">{day(d.current?.effectiveOn ?? null)}</span> },
    {
      key: "review",
      header: "Next review",
      sortable: true,
      hideOnMobile: true,
      value: (d) => d.current?.nextReviewOn ?? "9999",
      render: (d) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="tabular-nums">{day(d.current?.nextReviewOn ?? null)}</span>
          {d.reviewDue && (
            <Chip hue="sun" icon={CalendarClock}>
              Review due
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: "read",
      header: "Read",
      sortable: true,
      value: (d) => readPercent(d) ?? -1,
      render: (d) => {
        const pct = readPercent(d);
        if (pct === null) return <span className="text-xs text-neutral-500">{d.requiresAcknowledgement ? "Nobody asked yet" : "No read-back"}</span>;
        return (
          <span className="block w-36">
            <Progress value={pct} hue={pct === 100 ? "mint" : pct >= 70 ? "blue" : "sun"} size="sm" label={`${d.title}: ${pct}% read`} />
            <span className="mt-1 block text-xs tabular-nums text-neutral-500">
              {d.current?.acknowledged} of {d.current?.assigned} · {pct}%
            </span>
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Policies and SOPs"
        subtitle="Controlled documents: one version in force, reviewed on time, read by the people it is for."
        actions={
          <>
            <ButtonLink href="/suite/operations/documents" icon={FolderArchive}>
              Repository
            </ButtonLink>
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New controlled document
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="In force" value={inForce} icon={BookCheck} hint={`${docs.length} controlled ${docs.length === 1 ? "document" : "documents"} in all`} />
          <StatCard label="Review due" value={reviewDue} icon={CalendarClock} hue={reviewDue ? "sun" : "mint"} hint={reviewDue ? "Within 30 days, or past" : "Every review is in date"} />
          <StatCard label="Being revised" value={revising} icon={PenLine} hue="grape" hint="A version in draft, review or approval" />
          <StatCard label="Read" value={readAll === null ? "-" : `${readAll}%`} icon={BookOpenCheck} hue={readAll === null ? "slate" : readAll >= 90 ? "mint" : "sun"} hint={assigned ? `${acknowledged} of ${assigned} confirmations` : "Nothing sent to read yet"} />
        </StatGrid>

        {docs.length === 0 ? (
          <Card>
            <Empty
              icon={BookCheck}
              title="No controlled documents yet"
              hint="Set up a policy or SOP with its code and who must read it, then draft its first version with the file."
              action={
                <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                  Set up the first one
                </Button>
              }
            />
          </Card>
        ) : (
          <DataView rows={docs} columns={columns} rowKey={(d) => d.id} rowHref={(d) => `/suite/operations/documents/controlled/${d.id}`} {...listView} searchPlaceholder="Search by code or title" caption="Controlled documents" gridCols={3} />
        )}
      </div>

      {creating && (
        <ControlledDialog
          kinds={data.kinds}
          onClose={() => setCreating(false)}
          onDone={(d) => {
            setCreating(false);
            router.push(`/suite/operations/documents/controlled/${d.id}`);
          }}
        />
      )}
    </div>
  );
}
