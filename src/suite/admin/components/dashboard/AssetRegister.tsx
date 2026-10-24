import { Package } from "lucide-react";
import {
  DataTable,
  Pill,
  SectionCard,
  type DataTableColumn,
} from "@/components/suite/ui";
import { HUE } from "@/components/workspace/modules";
import { ADMIN_DATA, type AssetRow } from "@/lib/suite-data";

/**
 * The asset register.
 *
 * Each asset leads with a tinted icon tile and a two-line primary cell, the
 * way the workspace sets every list. Colour also marks the status pill, and
 * every pill carries the status word: the fixture ships a `tone` alongside the
 * word precisely so the two can never disagree.
 */

const COLUMNS: readonly DataTableColumn<AssetRow>[] = [
  {
    key: "tag",
    header: "Tag",
    render: (row: AssetRow) => (
      <span className="inline-flex whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-xs font-semibold text-neutral-800 tnum">
        {row.tag}
      </span>
    ),
  },
  {
    key: "item",
    header: "Asset",
    render: (row: AssetRow) => (
      <span className="flex min-w-[13rem] items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${HUE.sun.soft}`}
          aria-hidden="true"
        >
          <Package className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-neutral-900">{row.item}</span>
          <span className="block text-xs text-neutral-500">{row.category}</span>
        </span>
      </span>
    ),
  },
  {
    key: "assignee",
    header: "Assigned to",
    render: (row: AssetRow) =>
      row.assignee === "Unassigned" ? (
        <span className="text-neutral-500">Unassigned</span>
      ) : (
        <span className="whitespace-nowrap">{row.assignee}</span>
      ),
  },
  {
    key: "location",
    header: "Location",
    render: (row: AssetRow) => (
      <span className="whitespace-nowrap text-neutral-500">{row.location}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row: AssetRow) => <Pill tone={row.tone}>{row.status}</Pill>,
  },
];

export function AssetRegister() {
  const rows = ADMIN_DATA.assets;
  const unassigned = rows.filter((row) => row.assignee === "Unassigned").length;

  return (
    <SectionCard
      title="Asset register"
      subtitle={`${rows.length} of 486 records · ${unassigned} unassigned`}
      action={
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${HUE.sun.soft}`}
          aria-hidden="true"
        >
          <Package className="h-[18px] w-[18px]" />
        </span>
      }
      bodyClassName="py-1"
    >
      <DataTable
        columns={COLUMNS}
        rows={rows}
        caption="Asset register: tag, asset, category, holder, location and status."
      />
    </SectionCard>
  );
}
