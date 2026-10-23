import {
  DataTable,
  Pill,
  SectionCard,
  type DataTableColumn,
} from "@/components/suite/ui";
import { ADMIN_DATA, type AssetRow } from "@/lib/suite-data";

/**
 * The asset register.
 *
 * Admin's hue is ink, so this table earns its structure from hairlines, a
 * monospaced tag column and a two-line primary cell rather than from colour.
 * The one place colour appears is the status pill, and every pill carries the
 * status *word* — the fixture ships a `tone` alongside the word precisely so
 * the two can never disagree.
 */

const COLUMNS: readonly DataTableColumn<AssetRow>[] = [
  {
    key: "tag",
    header: "Tag",
    render: (row: AssetRow) => (
      <span className="font-mono text-xs font-medium text-neutral-900 tnum">
        {row.tag}
      </span>
    ),
  },
  {
    key: "item",
    header: "Asset",
    render: (row: AssetRow) => (
      <span className="block min-w-[11rem]">
        <span className="block font-medium text-neutral-900">{row.item}</span>
        <span className="block text-xs text-neutral-500">{row.category}</span>
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
