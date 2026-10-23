"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, CalendarClock, Download, FilePlus2, GitCommitVertical, Info, PenLine, Send, Stamp, UserRound, Users } from "lucide-react";
import { Button, Card, Chip, PageHeader, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { hueHex } from "@/components/workspace/charts";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { stampOf } from "@/suite/operations/components/assets/labels";
import { ApiError, repoError, repository, type ControlledDetail as Detail, type DocumentVersion, type ReadReportRow, type VersionStatus } from "@/lib/api/repository-client";
import { ControlledDialog, DraftVersionDialog, ReviewDialog } from "./ControlledDialogs";
import { VERSION, VersionChip } from "./parts";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt } from "@/lib/richText";

/**
 * A controlled document: its versions from draft through review and
 * approval to superseded, the next version's draft, the reviewer's
 * decision, and who has read the version in force, department by
 * department.
 */

const ROAD: VersionStatus[] = ["draft", "in_review", "in_approval", "approved"];

export default function ControlledDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [doc, setDoc] = useState<Detail | null>(null);
  const [kinds, setKinds] = useState<Record<string, string> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<"edit" | "draft" | "review" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meId = user?.id ?? null;

  useEffect(() => {
    let alive = true;
    repository.controlled.get(id).then(
      (d) => {
        if (!alive) return;
        setDoc(d);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This controlled document wasn't found." : `This controlled document didn't load. ${repoError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !doc) {
    return (
      <div>
        <BackLink href="/suite/operations/documents/controlled" label="Policies and SOPs" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!doc) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the controlled document…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const d = doc;
  const working = d.versions.find((v) => ["draft", "in_review", "in_approval"].includes(v.status)) ?? null;
  const mineToSend = working && working.status === "draft" && working.authorId === meId ? working : null;
  const mineToReview = working && working.status === "in_review" && working.reviewerId === meId ? working : null;

  const send = async (v: DocumentVersion) => {
    const ok = await confirm({
      title: v.reviewerId ? `Send version ${v.version} to ${v.reviewer ?? "the reviewer"}?` : `Send version ${v.version} for approval?`,
      body: v.reviewerId ? "They review it and pass it on to approval, or return it to you." : "With no reviewer named it goes straight to approval.",
      confirmLabel: v.reviewerId ? "Send for review" : "Send for approval",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      await repository.controlled.submit(v.id);
      refresh();
    } catch (e) {
      setActionError(repoError(e));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    setDialog("edit");
    if (!kinds) repository.controlled.list().then((r) => setKinds(r.kinds), (e: unknown) => setActionError(repoError(e)));
  };

  const assigned = d.current?.assigned ?? 0;
  const acknowledged = d.current?.acknowledged ?? 0;

  return (
    <div>
      <BackLink href="/suite/operations/documents/controlled" label="Policies and SOPs" />
      <PageHeader
        eyebrow={<span className="font-mono">{d.code}</span>}
        title={d.title}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <Chip hue="grape">{d.kindLabel}</Chip>
            {d.current ? <Chip hue="mint">v{d.current.version} in force</Chip> : <Chip>No version in force yet</Chip>}
            {d.reviewDue && (
              <Chip hue="sun" icon={CalendarClock}>
                Review due {day(d.current?.nextReviewOn ?? null)}
              </Chip>
            )}
          </span>
        }
        actions={
          <>
            <Button icon={PenLine} onClick={openEdit}>
              Edit
            </Button>
            {d.current?.documentId && (
              <a href={repository.downloadHref(d.current.documentId)} className={buttonClass("secondary")}>
                <Download size={17} aria-hidden />
                Download v{d.current.version}
              </a>
            )}
            {!working && (
              <Button variant="primary" icon={FilePlus2} onClick={() => setDialog("draft")}>
                Draft new version
              </Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      {working && (
        <Card className="mb-5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Being revised</p>
              <p className="mt-0.5 text-[15px] font-semibold text-neutral-900">
                Version {working.version} · {VERSION[working.status].label.toLowerCase()}
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600">{richExcerpt(working.changeSummary, 240)}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {mineToSend && (
                <Button variant="primary" icon={Send} disabled={busy} onClick={() => void send(mineToSend)}>
                  {mineToSend.reviewerId ? "Send for review" : "Send for approval"}
                </Button>
              )}
              {mineToReview && (
                <Button variant="primary" icon={Stamp} onClick={() => setDialog("review")}>
                  Review it
                </Button>
              )}
            </div>
          </div>
          <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Where this version is">
            {ROAD.map((s, i) => {
              const at = ROAD.indexOf(working.status);
              const reached = at >= i;
              const current = at === i;
              return (
                <li key={s} className="min-w-0">
                  <div className={cx("h-2 rounded-full", reached ? (current ? "bg-primary-500" : "bg-primary-300") : "ws-hatch")} />
                  <p className={cx("mt-2 truncate text-xs", current ? "font-semibold text-neutral-900" : reached ? "text-neutral-600" : "text-neutral-500")}>
                    {VERSION[s].label}
                    {current && <span className="sr-only"> (now)</span>}
                  </p>
                </li>
              );
            })}
          </ol>
          {working.status === "in_review" && !mineToReview && <p className="mt-3 text-sm text-neutral-600">With {working.reviewer ?? "the reviewer"} for review.</p>}
          {working.status === "in_approval" && <p className="mt-3 text-sm text-neutral-600">Waiting for approval. It comes into force once approved.</p>}
          {working.status === "draft" && !mineToSend && <p className="mt-3 text-sm text-neutral-600">{working.author ?? "Its author"} sends it on when it is ready.</p>}
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel
            title="Read report"
            subtitle={d.current ? `Version ${d.current.version}, by department` : "Once a version is approved, who has read it shows here"}
            icon={BookOpenCheck}
            hue="mint"
          >
            {!d.current ? (
              <p className="text-sm text-neutral-500">No version is in force yet.</p>
            ) : !d.requiresAcknowledgement ? (
              <p className="text-sm text-neutral-500">This document does not ask people to confirm they have read it.</p>
            ) : d.readReport.length === 0 ? (
              <p className="text-sm text-neutral-500">Nobody has been asked to read it yet.</p>
            ) : (
              <ReadReport rows={d.readReport} acknowledged={acknowledged} assigned={assigned} />
            )}
          </Panel>

          <Panel title="Versions" subtitle="Newest first" icon={GitCommitVertical} hue="grape">
            {d.versions.length === 0 ? (
              <div className="ws-hatch rounded-2xl px-5 py-10 text-center">
                <p className="text-sm font-semibold text-neutral-800">No versions yet</p>
                <p className="mt-1 text-sm text-neutral-600">Draft the first version with its file.</p>
                <Button variant="primary" icon={FilePlus2} className="mt-4" onClick={() => setDialog("draft")}>
                  Draft version 1.0
                </Button>
              </div>
            ) : (
              <ol className="relative space-y-4">
                <span className="absolute bottom-3 left-[15px] top-3 w-px bg-neutral-200" aria-hidden />
                {d.versions.map((v) => (
                  <VersionItem key={v.id} v={v} current={v.id === d.current?.id} />
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Who it is for" icon={Users} hue="sky">
            <p className="text-2xl font-bold tabular-nums text-neutral-900">{d.audienceSize}</p>
            <p className="text-sm text-neutral-600">
              {d.audience?.everyone
                ? "Everyone in the organisation"
                : (d.audience?.unitIds ?? []).length
                  ? `People in ${d.audience?.unitIds?.length} ${d.audience?.unitIds?.length === 1 ? "department" : "departments"}`
                  : (d.audience?.jobTitleIds ?? []).length
                    ? `People with ${d.audience?.jobTitleIds?.length} ${d.audience?.jobTitleIds?.length === 1 ? "job title" : "job titles"}`
                    : "Nobody chosen yet"}
            </p>
            <p className="mt-3 flex items-start gap-2 text-xs text-neutral-500">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              {d.requiresAcknowledgement ? "Each of them is asked to confirm they have read a new version once it is approved." : "They can read it; nobody is asked to confirm."}
            </p>
          </Panel>
          <Panel title="Owner" icon={UserRound} hue="blue">
            <p className="text-sm font-semibold text-neutral-900">{d.owner ?? "No owner named"}</p>
            <p className="text-sm text-neutral-600">{d.ownerUnit ?? "No owning department"}</p>
            {d.current && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-neutral-500">Effective</dt>
                  <dd className="font-medium text-neutral-900">{day(d.current.effectiveOn)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Next review</dt>
                  <dd className={cx("font-medium", d.reviewDue ? "text-sun-700" : "text-neutral-900")}>{day(d.current.nextReviewOn)}</dd>
                </div>
              </dl>
            )}
          </Panel>
        </div>
      </div>

      {dialog === "edit" && kinds && (
        <ControlledDialog
          doc={d}
          kinds={kinds}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog === "draft" && (
        <DraftVersionDialog
          doc={d}
          meId={meId}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog === "review" && mineToReview && (
        <ReviewDialog
          version={mineToReview}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function VersionItem({ v, current }: { v: DocumentVersion; current: boolean }) {
  const meta = VERSION[v.status] ?? VERSION.draft;
  const Icon = meta.icon;
  const people = [v.author && `Drafted by ${v.author}`, v.reviewer && `reviewer ${v.reviewer}`, v.approver && `approved by ${v.approver}`].filter(Boolean).join(" · ");
  return (
    <li className="relative flex gap-3">
      <span className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white" style={{ background: hueHex(meta.hue), color: "white" }}>
        <Icon size={15} aria-hidden />
      </span>
      <div className={cx("min-w-0 flex-1 rounded-xl border px-4 py-3", current ? "border-mint-500/40 bg-mint-50/40" : "border-neutral-200")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-neutral-900">v{v.version}</span>
          <VersionChip status={v.status} />
          {current && <Chip hue="mint">In force</Chip>}
          {v.documentId && (
            <a href={repository.downloadHref(v.documentId)} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary-700 hover:bg-primary-50" aria-label={`Download version ${v.version}`}>
              <Download size={13} aria-hidden />
              File
            </a>
          )}
        </div>
        {v.changeSummary && <RichTextView value={v.changeSummary} size="sm" className="mt-1.5 text-neutral-700" />}
        <p className="mt-1.5 text-xs text-neutral-500">
          {people}
          {people && " · "}
          {v.approvedAt ? `approved ${stampOf(v.approvedAt)}` : v.createdAt ? `drafted ${stampOf(v.createdAt)}` : ""}
          {v.effectiveOn ? ` · effective ${day(v.effectiveOn)}` : ""}
        </p>
        {(v.status === "approved" || v.status === "superseded") && v.assigned > 0 && (
          <p className="mt-1 text-xs text-neutral-500">
            Read by {v.acknowledged} of {v.assigned}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Each department as a bar: read in green, still to read hatched, the count
 * at the end, and the names of those still to read beneath.
 */
export function ReadReport({ rows, acknowledged, assigned }: { rows: ReadReportRow[]; acknowledged: number; assigned: number }) {
  const max = Math.max(1, ...rows.map((r) => r.assigned));
  const pct = assigned > 0 ? Math.round((acknowledged / assigned) * 100) : 0;
  return (
    <figure>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <p>
          <span className="text-3xl font-bold tabular-nums text-neutral-900">{pct}%</span>
          <span className="ml-2 text-sm text-neutral-600">
            read · {acknowledged} of {assigned} people
          </span>
        </p>
        <p className="flex items-center gap-3 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-mint-500" aria-hidden />
            Read
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="ws-hatch h-2.5 w-4 rounded-sm" aria-hidden />
            Still to read
          </span>
        </p>
      </div>
      <ul className="space-y-4">
        {rows.map((r) => {
          const out = r.assigned - r.acknowledged;
          return (
            <li key={r.unitId ?? "none"}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-neutral-800">{r.unit}</span>
                <span className="tabular-nums text-neutral-500">
                  <span className="font-semibold text-neutral-900">{r.acknowledged}</span>/{r.assigned}
                </span>
              </div>
              <div className="flex h-3.5 overflow-hidden rounded-full" style={{ width: `${Math.max(12, (r.assigned / max) * 100)}%` }} aria-hidden>
                <span className="h-full bg-mint-500" style={{ width: `${r.assigned ? (r.acknowledged / r.assigned) * 100 : 0}%` }} />
                <span className="ws-hatch h-full flex-1" />
              </div>
              {out > 0 && (
                <details className="mt-1.5 text-xs text-neutral-600">
                  <summary className="cursor-pointer select-none font-medium text-sun-700">
                    {out} still to read
                  </summary>
                  <p className="mt-1 leading-relaxed">{r.outstanding.join(", ")}</p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      <table className="sr-only">
        <caption>Who has read the version in force, by department</caption>
        <thead>
          <tr>
            <th scope="col">Department</th>
            <th scope="col">Read</th>
            <th scope="col">Asked</th>
            <th scope="col">Still to read</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.unitId ?? "none"}>
              <th scope="row">{r.unit}</th>
              <td>{r.acknowledged}</td>
              <td>{r.assigned}</td>
              <td>{r.outstanding.join(", ") || "Nobody"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
