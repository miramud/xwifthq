"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, CircleDollarSign, Layers, PenLine, Plus, ShieldCheck, Tag, TriangleAlert, Wrench } from "lucide-react";
import { ButtonLink, Button, Card, Empty, PageHeader, Panel, PersonAvatar, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Donut, StatusBars, hueHex } from "@/components/workspace/charts";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { hueFor, type Hue } from "@/components/workspace/modules";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount, compact } from "@/suite/finance/lib/format";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { assets, opsError, type AssetCategory, type AssetStatus, type AssetSummary, type RegisterMeta } from "@/lib/api/operations-assets-client";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { ASSET_STATUS, ASSET_STATUS_ORDER, assetStatus, plural } from "./labels";
import { AssetName, AssetTag, ConditionChip, MetaChip, usePickerOptions } from "./parts";
import AssetFormDialog from "./AssetFormDialog";

/**
 * The asset register: everything the organisation owns, where it is and who
 * holds it; what is waiting to be tagged or signed for; what the register
 * is worth by category.
 */

/** Statuses folded into the five things a reader asks: in store, with somebody, being dealt with, gone missing, gone. */
export const STATUS_GROUPS: { key: string; label: string; hue: Hue; statuses: AssetStatus[] }[] = [
  { key: "store", label: "In store", hue: "sky", statuses: ["in_store"] },
  { key: "out", label: "With somebody", hue: "mint", statuses: ["allocated", "in_transit"] },
  { key: "attention", label: "Being dealt with", hue: "sun", statuses: ["received", "under_maintenance", "disposal_pending"] },
  { key: "missing", label: "Lost or stolen", hue: "rose", statuses: ["lost", "stolen"] },
  { key: "gone", label: "Disposed", hue: "slate", statuses: ["disposed"] },
];

export function groupStatuses(byStatus: RegisterMeta["byStatus"]) {
  return STATUS_GROUPS.map((g) => ({ label: g.label, hue: g.hue, value: g.statuses.reduce((s, k) => s + (byStatus[k] ?? 0), 0) }));
}

export default function AssetRegister() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<{ assets: AssetSummary[]; meta: RegisterMeta } | null>(null);
  const [categories, setCategories] = useState<AssetCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [custodianId, setCustodianId] = useState("");
  const [adding, setAdding] = useState(false);
  const { staff } = usePickerOptions();
  const listView = useListView("ops-asset-register");

  useEffect(() => {
    let alive = true;
    assets.list({ status, categoryId, custodianId }).then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`The register didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload, status, categoryId, custodianId]);

  useEffect(() => {
    assets.categories().then(setCategories, () => setCategories([]));
  }, []);

  const catName = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  const columns: Column<AssetSummary>[] = [
    {
      key: "tag",
      header: "Tag",
      sortable: true,
      value: (a) => a.tagNo ?? "",
      render: (a) => <AssetTag tagNo={a.tagNo} code={a.categoryCode} size="sm" />,
      tableOnly: true,
    },
    {
      key: "name",
      header: "Asset",
      primary: true,
      sortable: true,
      value: (a) => `${a.name} ${a.tagNo ?? ""} ${a.serialNo ?? ""} ${a.make ?? ""} ${a.model ?? ""}`,
      render: (a) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{a.name}</span>
          {a.serialNo && <span className="block truncate font-mono text-xs text-neutral-500">S/N {a.serialNo}</span>}
        </span>
      ),
    },
    { key: "category", header: "Category", sortable: true, hideOnMobile: true, value: (a) => a.category ?? "" },
    { key: "status", header: "Status", sortable: true, value: (a) => assetStatus(a.status).label, render: (a) => <MetaChip meta={assetStatus(a.status)} /> },
    { key: "condition", header: "Condition", sortable: true, hideOnMobile: true, value: (a) => a.condition, render: (a) => <ConditionChip value={a.condition} /> },
    {
      key: "custodian",
      header: "Custodian",
      sortable: true,
      value: (a) => a.custodian ?? "",
      render: (a) =>
        a.custodian ? (
          <span className="flex min-w-0 items-center gap-2">
            <PersonAvatar name={a.custodian} size={24} />
            <span className="truncate">{a.custodian}</span>
          </span>
        ) : (
          <span className="text-neutral-500">-</span>
        ),
    },
    { key: "location", header: "Location", sortable: true, hideOnMobile: true, value: (a) => a.location ?? "", render: (a) => a.location ?? <span className="text-neutral-500">-</span> },
    { key: "cost", header: "Cost", align: "right", sortable: true, value: (a) => a.cost, render: (a) => <Money value={a.cost} className="font-semibold" /> },
  ];

  /* The assets as listed: the filters, the search and the sort. Cost is in the organisation's currency. */
  const exportCsv = (list: AssetSummary[]) =>
    downloadCsv(csvName("asset-register"), [
      ["Tag", "Name", "Category", "Make", "Model", "Serial number", "Status", "Condition", "Custodian", "Location", "Project", "Cost", "Currency", "Acquired on", "Warranty until"],
      ...list.map((a) => [
        a.tagNo ?? "",
        a.name,
        a.category ?? "",
        a.make ?? "",
        a.model ?? "",
        a.serialNo ?? "",
        assetStatus(a.status).label,
        a.condition.replace(/_/g, " "),
        a.custodian ?? "",
        a.location ?? "",
        a.project ? [a.project.code, a.project.name].filter(Boolean).join(" ") : "",
        csvAmount(a.cost),
        "NGN",
        csvDate(a.acquiredOn),
        csvDate(a.warrantyUntil),
      ]),
    ]);

  if (error && !data) return <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />;

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the asset register…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const m = data.meta;
  const canCreate = mayDoOps(user, "assets", "create");
  const groups = groupStatuses(m.byStatus);
  const byCategory = Object.entries(m.byCategory)
    .map(([id, v]) => ({ id, name: catName.get(id)?.name ?? "Other", code: catName.get(id)?.code ?? null, ...v }))
    .sort((a, b) => b.cost - a.cost);
  const filtered = Boolean(status || categoryId || custodianId);

  const toolbar = (
    <div className="flex flex-wrap gap-2">
      <SearchableSelect
        size="sm"
        aria-label="Status"
        className="w-44"
        value={status}
        onChange={setStatus}
        clearable
        clearLabel="Every status"
        placeholder="Every status"
        searchPlaceholder="Search statuses"
        options={ASSET_STATUS_ORDER.map((s) => ({ value: s, label: ASSET_STATUS[s].label, hint: String(m.byStatus[s] ?? 0) }))}
      />
      <SearchableSelect
        size="sm"
        aria-label="Category"
        className="w-44"
        value={categoryId}
        onChange={setCategoryId}
        clearable
        clearLabel="Every category"
        placeholder="Every category"
        searchPlaceholder="Search categories"
        options={(categories ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.code }))}
      />
      <SearchableSelect
        size="sm"
        aria-label="Custodian"
        className="w-48"
        value={custodianId}
        onChange={setCustodianId}
        clearable
        clearLabel="Anyone"
        placeholder="Anyone"
        searchPlaceholder="Search staff"
        noOptionsText={staff === null ? "Loading staff…" : "No staff found."}
        options={staff ?? []}
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Asset register"
        subtitle="Everything the organisation owns: where it is, who holds it, and what it is worth."
        actions={
          <>
            <ButtonLink href="/suite/operations/assets/categories" icon={Layers}>
              Categories and kits
            </ButtonLink>
            {canCreate && (
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add asset
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-5">
        <StatGrid cols={3}>
          <StatCard featured label="Assets on the register" value={m.total} icon={Boxes} hint={`${plural(groups[1].value, "with somebody", "with somebody")} · ${plural(groups[0].value, "in store", "in store")}`} />
          <StatCard label="Cost of the register" value={compact(m.cost)} icon={CircleDollarSign} hue="grape" hint={amount(m.cost)} />
          <StatCard label="Waiting to be tagged" value={m.awaitingTag} icon={Tag} hue={m.awaitingTag ? "sun" : "slate"} hint={m.awaitingTag ? "Received, no tag yet" : "Everything received is tagged"} />
          <StatCard label="Handovers not yet signed" value={m.pendingHandovers} icon={PenLine} hue={m.pendingHandovers ? "sky" : "slate"} hint="In transit until the receiver signs" />
          <StatCard label="Warranty ending in 60 days" value={m.warrantyEnding} icon={ShieldCheck} hue={m.warrantyEnding ? "coral" : "slate"} hint="Renew or plan the replacement" />
          <StatCard label="Faulty or beyond repair" value={m.faulty} icon={Wrench} hue={m.faulty ? "rose" : "slate"} hint="Repair, replace or propose disposal" />
        </StatGrid>

        {m.total === 0 ? (
          <Card>
            <Empty
              icon={Boxes}
              title="The register is empty"
              hint="Assets arrive here when goods received against a purchase order are approved, or when you add one by hand. Set up categories first so each gets the right tag code."
              action={
                canCreate ? (
                  <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                    Add the first asset
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid gap-5 xl:grid-cols-5">
            <Panel title="Where everything is" subtitle="Every asset on the register, by status" icon={Boxes} hue="sky" className="xl:col-span-2">
              <Donut data={groups} total={m.total} centerLabel="assets" caption="Assets by where they are" />
              <StatusStrip byStatus={m.byStatus} total={m.total} />
            </Panel>
            <Panel title="Value by category" subtitle="Cost of what is on the register" icon={CircleDollarSign} hue="grape" className="xl:col-span-3">
              {byCategory.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-500">No assets yet.</p>
              ) : (
                <StatusBars
                  data={byCategory.map((c) => ({ label: c.code ? `${c.name} (${c.code})` : c.name, value: c.cost, hue: hueFor(c.name), note: plural(c.count, "asset") }))}
                  format={(v) => compact(v)}
                  caption="Cost of the register by category"
                />
              )}
            </Panel>
          </div>
        )}

        {(m.total > 0 || filtered) && (
          <DataView
            rows={data.assets}
            columns={columns}
            rowKey={(a) => a.id}
            rowHref={(a) => `/suite/operations/assets/${a.id}`}
            {...listView}
            toolbar={toolbar}
            searchPlaceholder="Search by tag, name, serial or make"
            onDownload={exportCsv}
            caption="Assets"
            gridCols={3}
            renderCard={(a) => <AssetCard asset={a} />}
            renderListItem={(a) => <AssetRow asset={a} />}
            empty={
              <div className="px-5 py-10 text-center text-sm text-neutral-500">
                <TriangleAlert size={18} className="mx-auto mb-2 text-neutral-400" aria-hidden />
                Nothing matches these filters. Clear one to see more.
              </div>
            }
          />
        )}
      </div>

      {adding && (
        <AssetFormDialog
          categories={categories}
          onClose={() => setAdding(false)}
          onDone={(a) => {
            setAdding(false);
            router.push(`/suite/operations/assets/${a.id}`);
          }}
        />
      )}
    </div>
  );
}

/** One bar, every status its share of it, with the count in words beneath. */
function StatusStrip({ byStatus, total }: { byStatus: RegisterMeta["byStatus"]; total: number }) {
  const parts = ASSET_STATUS_ORDER.map((s) => ({ s, n: byStatus[s] ?? 0 })).filter((p) => p.n > 0);
  if (total === 0 || parts.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${ASSET_STATUS[p.s].label}: ${p.n}`).join(", ")}>
        {parts.map((p) => (
          <span key={p.s} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.n / total) * 100}%`, background: hueHex(ASSET_STATUS[p.s].hue) }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-600">
        {parts.map((p) => {
          const meta = ASSET_STATUS[p.s];
          const Icon = meta.icon;
          return (
            <li key={p.s} className="inline-flex items-center gap-1.5">
              <Icon size={12} aria-hidden style={{ color: hueHex(meta.hue) }} />
              {meta.label} <span className="font-semibold tabular-nums text-neutral-900">{p.n}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AssetCard({ asset: a }: { asset: AssetSummary }) {
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <AssetTag tagNo={a.tagNo} code={a.categoryCode} />
        <Money value={a.cost} className="text-sm font-bold text-neutral-900" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-neutral-900">{a.name}</p>
        <p className="truncate text-xs text-neutral-500">{[a.category, a.location].filter(Boolean).join(" · ") || "-"}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <MetaChip meta={assetStatus(a.status)} />
        <ConditionChip value={a.condition} />
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-neutral-100 pt-3 text-sm text-neutral-600">
        {a.custodian ? (
          <>
            <PersonAvatar name={a.custodian} size={24} />
            <span className="truncate">{a.custodian}</span>
          </>
        ) : (
          <span className="text-neutral-500">Nobody holds it</span>
        )}
      </div>
    </div>
  );
}

function AssetRow({ asset: a }: { asset: AssetSummary }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <AssetName tagNo={a.tagNo} code={a.categoryCode} name={a.name} category={a.category} />
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <MetaChip meta={assetStatus(a.status)} />
        <span className="text-xs text-neutral-500">{a.custodian ?? a.location ?? ""}</span>
      </div>
    </div>
  );
}
