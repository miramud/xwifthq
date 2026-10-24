"use client";

import { ChevronDown, ChevronRight, Users } from "lucide-react";
import type { OrgUnit } from "@/lib/api/org-foundations-client";
import { Chip, cx } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import { FaceAvatar } from "@/suite/lms/components/ui/ws";
import { visibleRows, type UnitNode } from "./logic";

/*
  The unit tree two ways: an indented list (every unit, collapsible, the
  facts on each row) and an org chart (boxes joined by lines, for seeing the
  shape). Both select a unit for the side panel.
*/

export const KIND_HUE: Record<string, Hue> = { division: "grape", department: "blue", unit: "sky", team: "mint" };

export function KindChip({ kind }: { kind: string }) {
  return <Chip hue={KIND_HUE[kind] ?? "slate"}>{kind.charAt(0).toUpperCase() + kind.slice(1)}</Chip>;
}

export function HeadBadge({ unit, compact = false }: { unit: OrgUnit; compact?: boolean }) {
  const head = unit.head;
  if (!head) return <span className="text-xs text-neutral-500">No head</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <FaceAvatar name={head.name} size={compact ? 22 : 26} />
      <span className="truncate text-[13px] text-neutral-700">{head.name ?? "Someone"}</span>
      {head.role === "acting" && (
        <Chip hue="sun" className="!px-2 !py-0.5 !text-[11px]">
          Acting
        </Chip>
      )}
      {head.role === "deputy" && (
        <Chip hue="slate" className="!px-2 !py-0.5 !text-[11px]">
          Deputy
        </Chip>
      )}
    </span>
  );
}

export function UnitTreeList({
  tree,
  collapsed,
  onToggle,
  selectedId,
  onSelect,
}: {
  tree: UnitNode[];
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rows = visibleRows(tree, collapsed);
  return (
    <ul aria-label="Units" className="divide-y divide-neutral-100">
      {rows.map(({ unit, children, level }) => {
        const open = !collapsed.has(unit.id);
        const on = unit.id === selectedId;
        return (
          <li key={unit.id} className={cx("flex items-stretch transition-colors", on ? "bg-primary-50/70 shadow-[inset_3px_0_0] shadow-primary-500" : "hover:bg-neutral-50/70")}>
            {/* Guide rails: one per ancestor, so the depth reads at a glance. */}
            <span className="flex shrink-0 pl-2" aria-hidden>
              {Array.from({ length: level }, (_, i) => (
                <span key={i} className="mx-[9px] w-px bg-neutral-200" />
              ))}
            </span>
            {children.length > 0 ? (
              <button
                type="button"
                onClick={() => onToggle(unit.id)}
                aria-expanded={open}
                aria-label={`${open ? "Collapse" : "Expand"} ${unit.name}`}
                className="flex w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                {open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
              </button>
            ) : (
              <span className="flex w-11 shrink-0 items-center justify-center" aria-hidden>
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
              </span>
            )}
            <button
              type="button"
              onClick={() => onSelect(unit.id)}
              aria-current={on ? "true" : undefined}
              className="flex min-h-14 min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 pr-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300"
            >
              <span className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
                <span className="shrink-0 rounded-lg bg-primary-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-700">{unit.code}</span>
                <span className={cx("truncate text-sm font-semibold", unit.status === "retired" ? "text-neutral-500 line-through" : "text-neutral-900")}>
                  {unit.name}
                </span>
                {unit.status === "retired" && <Chip hue="slate">Retired</Chip>}
              </span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <KindChip kind={unit.kind} />
                <span className="w-44 min-w-0 max-w-full">
                  <HeadBadge unit={unit} compact />
                </span>
                <span className="inline-flex w-14 items-center gap-1 text-xs tabular-nums text-neutral-600" title="Members">
                  <Users size={13} aria-hidden className="text-neutral-400" />
                  {unit.memberCount ?? 0}
                  <span className="sr-only"> members</span>
                </span>
                <span className="hidden w-20 truncate font-mono text-xs text-neutral-500 md:inline">
                  {unit.defaultCostCentre ? (
                    <>
                      <span className="sr-only">Cost centre </span>
                      {unit.defaultCostCentre.code}
                    </>
                  ) : (
                    <span className="font-sans">No cost centre</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Boxes joined by lines, top-down. Scrolls sideways inside its card when wide. */
export function OrgChart({ tree, selectedId, onSelect }: { tree: UnitNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto pb-2">
      <ul className="flex min-w-max justify-center gap-6 px-2 pt-1" aria-label="Organisation chart">
        {tree.map((n) => (
          <ChartNode key={n.unit.id} node={n} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );
}

function ChartNode({ node, selectedId, onSelect }: { node: UnitNode; selectedId: string | null; onSelect: (id: string) => void }) {
  const { unit, children } = node;
  const on = unit.id === selectedId;
  return (
    <li className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => onSelect(unit.id)}
        aria-current={on ? "true" : undefined}
        className={cx(
          "w-48 cursor-pointer rounded-[1.25rem] border bg-white p-3.5 text-left shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300 motion-reduce:hover:translate-y-0",
          on ? "border-primary-400 ring-2 ring-primary-100" : "border-neutral-100 hover:border-primary-200",
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="rounded-lg bg-primary-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-700">{unit.code}</span>
          <KindChip kind={unit.kind} />
        </span>
        <span className="mt-1.5 block truncate text-sm font-semibold text-neutral-900">{unit.name}</span>
        <span className="mt-2 block">
          <HeadBadge unit={unit} compact />
        </span>
      </button>
      {children.length > 0 && (
        <>
          <span className="h-5 w-px bg-neutral-300" aria-hidden />
          <ul className="flex gap-4">
            {children.map((c, i) => (
              <li key={c.unit.id} className="relative flex flex-col items-center pt-5">
                {/* The rail across the siblings, drawn in halves so it stops at the outer two. */}
                {children.length > 1 && (
                  <span
                    className={cx("absolute top-0 h-px bg-neutral-300", i === 0 ? "left-1/2" : "left-0", i === children.length - 1 ? "right-1/2" : "-right-4")}
                    aria-hidden
                  />
                )}
                <span className="absolute left-1/2 top-0 h-5 w-px bg-neutral-300" aria-hidden />
                <ul className="contents">
                  <ChartNode node={c} selectedId={selectedId} onSelect={onSelect} />
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}
