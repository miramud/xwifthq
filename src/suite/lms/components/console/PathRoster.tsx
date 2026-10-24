"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { Empty, Panel } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { assignments, ApiError, type PathAssignee } from "@/lib/api/saas-client";
import { FaceAvatar, Skeleton, StatusChip } from "@/suite/lms/components/ui/ws";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * Who holds this path, and taking it off them.
 *
 * A path could be granted to forty people and the only thing the product would
 * tell you afterwards was that the number was forty. Nobody could see who they
 * were, and nobody could take it back from one of them.
 *
 * That matters most where a path is mandatory: an assignment made in error
 * shows on the compliance report as a person failing training they were never
 * supposed to do, and the only remedy was to let them complete it.
 *
 * Revoking withdraws access and keeps the record. Somebody who worked through
 * two courses of a path before it was taken off them did that work, and
 * granting it again later picks up where they left off.
 */
export default function PathRoster({ slug }: { slug: string }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<PathAssignee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await assignments.pathRoster(slug));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We could not load who has this path.");
    }
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    assignments
      .pathRoster(slug)
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const revoke = async (assignee: PathAssignee) => {
    const who = assignee.name ?? "this learner";
    const ok = await confirm({
      title: `Un-assign this path from ${who}?`,
      body: `${who} no longer has the path. The courses it already gave them, and their progress on them, are kept. Un-assigning does not go to the recycle bin.`,
      confirmLabel: "Un-assign",
    });
    if (!ok) return;

    setRemoving(assignee.userId);

    try {
      await assignments.revokePath(slug, assignee.userId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We could not save that change.");
    } finally {
      setRemoving(null);
    }
  };

  if (error !== null && rows === null) {
    return (
      <Panel title="Who has this path" icon={Users} hue="blue">
        <Empty icon={AlertTriangle} hue="coral" title="We could not load this list" hint={error} />
      </Panel>
    );
  }

  const overdue = (rows ?? []).filter((row) => row.isOverdue).length;

  const state = (row: PathAssignee) =>
    row.isComplete ? (
      <StatusChip status="completed" label="Finished" />
    ) : row.isOverdue ? (
      <StatusChip status="overdue" label="Overdue" />
    ) : (
      <StatusChip status="in_progress" label="In progress" />
    );

  // Confirmed in the shared dialog, which names the person: the row it sits
  // on is the only thing distinguishing them from the one above.
  const action = (row: PathAssignee) => (
      <button
        type="button"
        disabled={removing === row.userId}
        onClick={() => void revoke(row)}
        aria-label={`Un-assign ${row.name ?? "this learner"}`}
        className="h-9 cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 outline-none transition-colors hover:border-error-500/30 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Un-assign
      </button>
    );

  const meta = (row: PathAssignee) => (
    <>
      {row.email}
      {row.assignedBy !== null && ` · assigned by ${row.assignedBy}`}
    </>
  );

  const columns: Column<PathAssignee>[] = [
    {
      key: "name",
      header: "Learner",
      primary: true,
      sortable: true,
      value: (r) => r.name ?? "",
      render: (r) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={r.name ?? "?"} size={34} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{r.name ?? "Unnamed"}</span>
            <span className="block truncate text-xs text-neutral-500">{meta(r)}</span>
          </span>
        </span>
      ),
    },
    {
      key: "state",
      header: "Progress",
      sortable: true,
      value: (r) => (r.isComplete ? "Finished" : r.isOverdue ? "Overdue" : "In progress"),
      render: state,
    },
    { key: "action", header: "", align: "right", tableOnly: true, render: action },
  ];

  return (
    <Panel
      title="Who has this path"
      subtitle={
        rows === null
          ? undefined
          : overdue > 0
            ? `${rows.length} assigned · ${overdue} past their date`
            : `${rows.length} assigned`
      }
      icon={Users}
      hue="blue"
    >
      {rows === null ? (
        <Skeleton className="h-32" />
      ) : rows.length === 0 ? (
        <Empty icon={Users} title="Nobody yet" hint="Assign this path and the people who have it show up here." />
      ) : (
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          storageKey="lms.path-roster"
          caption="People who hold this path"
          searchPlaceholder="Search people"
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <FaceAvatar name={r.name ?? "?"} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{r.name ?? "Unnamed"}</p>
                  <p className="truncate text-xs text-neutral-500">{meta(r)}</p>
                </div>
              </div>
              <div>{state(r)}</div>
              <div className="mt-auto border-t border-neutral-100 pt-3">{action(r)}</div>
            </div>
          )}
          renderListItem={(r) => (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3">
              <FaceAvatar name={r.name ?? "?"} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{r.name ?? "Unnamed"}</p>
                <p className="truncate text-xs text-neutral-500">{meta(r)}</p>
              </div>
              {state(r)}
              {action(r)}
            </div>
          )}
        />
      )}

      {/*
        Said once, under the list, rather than in every confirmation. It is the
        thing somebody needs to know before pressing any of them.
      */}
      {rows !== null && rows.length > 0 && (
        <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
          Un-assigning withdraws access and keeps what they have already done. If you assign the path again later, they
          pick up where they left off.
        </p>
      )}
    </Panel>
  );
}
