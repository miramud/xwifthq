"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, GitBranch, Link2, Loader, Plus, X } from "lucide-react";
import { Button, Chip } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  dependencies as dependenciesApi,
  type Dependency,
  type DependencyTypeKey,
  type DependencyTypeOption,
} from "@/lib/api/projects-client";
import { IconTile, ItemRef, hintCls, inputCls, labelCls } from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * What this item waits for, and what waits for it.
 *
 * **These save immediately, and the panel around them does not.** A dependency
 * is its own resource with its own endpoints, and pretending otherwise would
 * mean either holding edges in memory until somebody presses Save, losing
 * them on a cancel they meant as "cancel my title change", or writing them
 * twice. The heading says so rather than leaving people to discover it.
 *
 * **A link that would close a loop is refused by the server, not hidden here.**
 * The client could grey out anything reachable from this item, and that is
 * exactly the wrong trade: it would need the whole graph on every keystroke,
 * and the one thing it cannot do is *explain*. The server's refusal names the
 * loop, "A → B → C → A", which is the only form of the message anybody can
 * act on. So this renders it verbatim.
 *
 * **A lead reads as an overlap, never as a negative number.** "May start 2
 * days before it finishes" is a sentence a project manager can check; `-2` is
 * a field they will assume is a bug.
 *
 * **The four relations come from the server, wording included.** Sprint 8 added
 * start-to-start, finish-to-finish and start-to-finish; hardcoding four
 * strings and twelve wordings here would mean a fifth relation needing a
 * frontend release, and three screens wording the same edge three ways.
 */
export default function ItemDependencies({
  slug,
  itemId,
  onChanged,
}: {
  slug: string;
  itemId: string;
  /** The schedule moved, whatever is showing it should re-read. */
  onChanged?: () => void;
}) {
  const confirm = useConfirm();
  const [dependsOn, setDependsOn] = useState<Dependency[]>([]);
  const [blocks, setBlocks] = useState<Dependency[]>([]);
  const [candidates, setCandidates] = useState<
    { id: string; title: string; externalRef: string | null }[]
  >([]);
  const [types, setTypes] = useState<DependencyTypeOption[]>([]);
  const [canManage, setCanManage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [predecessorId, setPredecessorId] = useState("");
  const [lagDays, setLagDays] = useState("0");
  const [type, setType] = useState<DependencyTypeKey>("finish_to_start");
  const [saving, setSaving] = useState(false);
  /* The server's refusal, which names the loop. Kept apart from `error`. */
  const [refusal, setRefusal] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;

    setLoading(true);

    dependenciesApi
      .forItem(slug, itemId)
      .then((response) => {
        if (!live) return;

        setDependsOn(response.data.dependsOn);
        setBlocks(response.data.blocks);
        setCandidates(response.meta.candidates);
        setTypes(response.meta.types);
        setCanManage(response.meta.canManage);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!live) return;

        setError(e instanceof ApiError ? e.message : "Could not load dependencies.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [slug, itemId, reloadKey]);

  /*
   * Anything already linked in either direction is not offered again. The
   * server would reject the duplicate anyway; offering it teaches nothing.
   */
  const offerable = useMemo(() => {
    const taken = new Set(
      [...dependsOn, ...blocks].map((d) => d.itemId).filter((id): id is string => id !== null),
    );

    return candidates.filter((candidate) => !taken.has(candidate.id));
  }, [candidates, dependsOn, blocks]);

  async function add() {
    if (predecessorId === "") return;

    setSaving(true);
    setRefusal(null);

    try {
      await dependenciesApi.add(slug, itemId, {
        predecessorId,
        type,
        lagDays: Number.parseInt(lagDays, 10) || 0,
      });

      setPredecessorId("");
      setLagDays("0");
      setType("finish_to_start");
      setAdding(false);
      setReloadKey((key) => key + 1);
      onChanged?.();
    } catch (e: unknown) {
      /*
       * The 422 carries the loop by name. Anything else is a real failure and
       * says so plainly rather than borrowing the scheduler's vocabulary.
       */
      setRefusal(
        e instanceof ApiError
          ? (e.errors?.predecessorId?.[0] ?? e.message)
          : "Could not add that link.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(dependencyId: string) {
    const row = [...dependsOn, ...blocks].find((d) => d.id === dependencyId);
    const ok = await confirm({
      title: row?.title ? `Unlink “${row.title}”?` : "Remove this dependency?",
      body: "Neither item is deleted; the schedule stops tying them together. Unlinking does not go to the recycle bin, so add the link again to put it back.",
      confirmLabel: "Unlink",
    });
    if (!ok) return;

    try {
      await dependenciesApi.remove(slug, itemId, dependencyId);

      setReloadKey((key) => key + 1);
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Could not remove that link.");
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-neutral-500">
        <Loader size={14} className="animate-spin" aria-hidden />
        Loading dependencies…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={GitBranch} hue="grape" size={34} />
          <div className="min-w-0">
            <h4 className="text-[15px] font-bold text-neutral-900">Dependencies</h4>
            <p className="mt-0.5 text-xs text-neutral-500">
              Saved as you add them, separately from the rest of this form.
            </p>
          </div>
        </div>

        {canManage && !adding && offerable.length > 0 && (
          <Button size="sm" icon={Plus} onClick={() => setAdding(true)} className="shrink-0">
            Add
          </Button>
        )}
      </div>

      {error && <p className="text-xs font-medium text-error-700">{error}</p>}

      {adding && (
        <div className="space-y-3 rounded-2xl border border-grape-100 bg-grape-50/40 p-4">
          <div>
            <label htmlFor="dep-predecessor" className={labelCls}>
              This item waits for
            </label>
            <SearchableSelect
              id="dep-predecessor"
              value={predecessorId}
              onChange={setPredecessorId}
              placeholder="Choose an item…"
              searchPlaceholder="Search items"
              options={offerable.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.externalRef ? `${candidate.externalRef}: ` : ""}${candidate.title}`,
              }))}
            />
          </div>

          {types.length > 0 && (
            <div>
              <label htmlFor="dep-type" className={labelCls}>
                How they relate
              </label>
              <SearchableSelect
                id="dep-type"
                value={type}
                onChange={(value) => setType(value as DependencyTypeKey)}
                aria-describedby="dep-type-hint"
                options={types.map((option) => ({ value: option.value, label: option.label }))}
              />
              {/* The server's own wording for the chosen relation, with no lag. */}
              <p id="dep-type-hint" className={hintCls}>
                This item {types.find((o) => o.value === type)?.describes ?? ""}.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="dep-lag" className={labelCls}>
              Days between them
            </label>
            <input
              id="dep-lag"
              type="number"
              min={-90}
              max={365}
              value={lagDays}
              onChange={(e) => setLagDays(e.target.value)}
              aria-describedby="dep-lag-hint"
              className={inputCls}
            />
            {/*
              A lead is a legitimate plan, not a typo, so the hint explains the
              negative rather than the field refusing it.
            */}
            <p id="dep-lag-hint" className={hintCls}>
              0 means no gap. A positive number pushes this one later; a
              negative one lets the two overlap.
            </p>
          </div>

          {refusal && (
            <p
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-xs font-medium text-error-700"
            >
              {refusal}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Link2}
              disabled={saving || predecessorId === ""}
              onClick={() => void add()}
            >
              {saving ? "Linking…" : "Link"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setAdding(false);
                setRefusal(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Edges
        heading="Waits for"
        empty="Nothing. This can start whenever the team is ready."
        rows={dependsOn}
        canManage={canManage}
        onRemove={remove}
      />

      {/*
        The other direction is read-only here on purpose: it is edited from the
        item that actually waits, which is where somebody deciding the order is
        looking. Two places to write the same edge is two places to get it
        wrong.
      */}
      <Edges
        heading="Blocks"
        empty="Nothing is waiting on this."
        rows={blocks}
        canManage={false}
        onRemove={remove}
      />
    </div>
  );
}

function Edges({
  heading,
  empty,
  rows,
  canManage,
  onRemove,
}: {
  heading: string;
  empty: string;
  rows: Dependency[];
  canManage: boolean;
  onRemove: (id: string) => void | Promise<void>;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {heading}
        {rows.length > 0 && (
          <Chip hue="slate" className="!px-1.5 !py-0 text-[10px]">
            {rows.length}
          </Chip>
        )}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-2.5 text-xs text-neutral-500">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start gap-3 rounded-2xl border border-neutral-200/80 bg-white px-3 py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-grape-50 text-grape-700">
                <ArrowRight size={14} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-neutral-900">
                  {row.externalRef && <ItemRef value={row.externalRef} />}
                  <span className="truncate">{row.title ?? "An item that no longer exists"}</span>
                </p>
                {/* Worded once on the server, so three screens agree. */}
                <p className="mt-0.5 text-xs text-neutral-500">
                  {row.describes}
                  {/*
                    The relation named as well as described, because "starts
                    when it finishes" and "finishes when it starts" are one
                    word apart and mean opposite things.
                  */}
                  {row.type !== "finish_to_start" && <span className="ml-1">({row.typeLabel})</span>}
                </p>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => void onRemove(row.id)}
                  aria-label={`Unlink ${row.title ?? "this item"}`}
                  className="-my-1.5 -mr-1.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-error-50 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
