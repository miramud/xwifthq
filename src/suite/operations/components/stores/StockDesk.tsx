"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, BarChart3, Boxes, ClipboardList, History, MapPin, PackagePlus, Pencil, PieChart, Plus, Siren, TriangleAlert, Wallet, Warehouse } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ColumnChart, Donut, Heatmap } from "@/components/workspace/charts";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Skeleton, StatCard, Switch } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact } from "@/suite/finance/lib/format";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { opsError, procurement } from "@/lib/api/operations-procurement-client";
import { stores, type StockDesk as Desk, type StockItem, type StoreRow } from "@/lib/api/operations-stores-client";
import { qty } from "@/suite/operations/components/procurement/meta";
import { csvAmount, csvName, downloadCsv } from "@/components/workspace/csv";
import { categoryHue, valueByCategory } from "./meta";
import { LevelGauge } from "./ui";
import { ItemDialog, ReceiveDialog, StoreDialog, TransferDialog } from "./StockDialogs";
import { ReorderPanel } from "./ReorderPanel";
import { StockLedgerDrawer } from "./StockLedgerDrawer";

/**
 * The stores desk (Admin & Ops PRD §10): what each store holds and what it
 * is worth at average cost, where every item sits against its reorder level,
 * the restock to draft, and the stores themselves. Receipts by hand and
 * transfers are here; deliveries against an order come in on the GRN.
 */

type Dialog =
  | { kind: "item"; item: StockItem | null }
  | { kind: "store"; store: StoreRow | null }
  | { kind: "receive"; itemId?: string }
  | { kind: "transfer"; itemId?: string };

export default function StockDesk() {
  const { user } = useAuth();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [ledger, setLedger] = useState<StockItem | null>(null);
  const [vendors, setVendors] = useState<SelectOption[]>([]);
  const [costCentres, setCostCentres] = useState<SelectOption[]>([]);
  const [category, setCategory] = useState("");
  const [belowOnly, setBelowOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    let alive = true;
    stores.desk().then(
      (d) => {
        if (!alive) return;
        setDesk(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`The stores didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    let alive = true;
    procurement.me.options().then(
      (o) => {
        if (!alive) return;
        setVendors(o.vendors.map((v) => ({ value: v.id, label: v.name })));
        setCostCentres(o.costCentres.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })));
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  const can = {
    item: mayDoOps(user, "stores", "create_item"),
    editItem: mayDoOps(user, "stores", "update_item"),
    store: mayDoOps(user, "stores", "create_store"),
    editStore: mayDoOps(user, "stores", "update_store"),
    receive: mayDoOps(user, "stores", "receive"),
    transfer: mayDoOps(user, "stores", "transfer"),
    reorder: mayDoOps(user, "stores", "draft_reorder"),
  };

  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
    setReload((n) => n + 1);
  };

  const storeNames = useMemo(() => Object.fromEntries((desk?.stores ?? []).map((s) => [s.id, s.name])), [desk]);
  const items = useMemo(() => (desk?.items ?? []).filter((i) => (showInactive || i.active) && (!category || i.category === category) && (!belowOnly || i.belowReorder)), [desk, category, belowOnly, showInactive]);

  const header = (
    <PageHeader
      eyebrow="Stores"
      title="Stock"
      subtitle="What each store holds, what it is worth at average cost, and what needs restocking."
      actions={
        <>
          <ButtonLink href="/suite/operations/stores/consumption" icon={BarChart3}>
            Consumption
          </ButtonLink>
          {can.transfer && desk && desk.stores.length > 1 && (
            <Button icon={ArrowLeftRight} onClick={() => setDialog({ kind: "transfer" })}>
              Transfer
            </Button>
          )}
          {can.item && (
            <Button icon={Plus} onClick={() => setDialog({ kind: "item", item: null })}>
              Add item
            </Button>
          )}
          {can.receive && (
            <Button variant="primary" icon={PackagePlus} onClick={() => setDialog({ kind: "receive" })} disabled={!desk}>
              Receive stock
            </Button>
          )}
        </>
      }
    />
  );

  if (error && !desk)
    return (
      <div>
        {header}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );

  if (!desk)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading the stores…</p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <div className="mb-5 grid gap-5 xl:grid-cols-3">
          <Skeleton className="h-80 xl:col-span-2" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  const live = desk.items.filter((i) => i.active);
  const value = live.reduce((s, i) => s + i.value, 0);
  const below = live.filter((i) => i.belowReorder);
  const criticalBelow = below.filter((i) => i.critical);
  const byCategory = valueByCategory(live, desk.categories);
  const activeStores = desk.stores.filter((s) => s.active);

  return (
    <div>
      {header}
      <Notice text={notice} />

      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="Items" value={live.length} icon={Boxes} hint={`In ${activeStores.length} ${activeStores.length === 1 ? "store" : "stores"}`} />
          <StatCard label="Stock value" value={compact(value)} icon={Wallet} hue="mint" hint="At weighted-average cost" />
          <StatCard label="Below reorder" value={below.length} icon={TriangleAlert} hue={below.length ? "coral" : "mint"} hint={below.length ? "Counting what is on order" : "All above their level"} />
          <StatCard label="Critical below reorder" value={criticalBelow.length} icon={Siren} hue={criticalBelow.length ? "rose" : "mint"} hint={criticalBelow.length ? criticalBelow.slice(0, 2).map((i) => i.name).join(", ") : "None at risk"} />
        </StatGrid>

        {live.length > 0 && (
          <div className="grid gap-5 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title={activeStores.length > 1 ? "Where the stock sits" : "Most valuable stock"}
              subtitle={activeStores.length > 1 ? "On hand by store, for the twelve most valuable items" : "The twelve items holding the most value"}
              icon={activeStores.length > 1 ? Warehouse : BarChart3}
              hue="sky"
            >
              <WhereItSits desk={desk} />
            </Panel>
            <Panel title="Value by category" subtitle={`${compact(value)} at average cost`} icon={PieChart} hue="grape">
              <Donut
                data={byCategory.slice(0, 6).map((c) => ({ label: c.label, value: c.value, hue: categoryHue(c.key) }))}
                total={compact(value)}
                centerLabel="in stock"
                caption="Stock value by category"
                legend="below"
                size={170}
                format={(v) => compact(v)}
              />
            </Panel>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ReorderPanel costCentres={costCentres} canDraft={can.reorder} version={reload} onDrafted={() => setReload((n) => n + 1)} />
          </div>
          <StoresPanel stores={desk.stores} items={desk.items} canAdd={can.store} canEdit={can.editStore} onAdd={() => setDialog({ kind: "store", store: null })} onEdit={(s) => setDialog({ kind: "store", store: s })} />
        </div>

        <ItemsTable
          desk={desk}
          items={items}
          can={can}
          onLedger={setLedger}
          onEdit={(i) => setDialog({ kind: "item", item: i })}
          onReceive={(i) => setDialog({ kind: "receive", itemId: i.id })}
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <SearchableSelect
                value={category}
                onChange={setCategory}
                options={Object.entries(desk.categories).map(([v, l]) => ({ value: v, label: l }))}
                clearable
                clearLabel="All categories"
                placeholder="All categories"
                searchPlaceholder="Search categories"
                size="sm"
                aria-label="Category"
                className="w-48"
              />
              <span className="flex items-center gap-2 text-sm text-neutral-700">
                <Switch checked={belowOnly} onChange={setBelowOnly} label="Below reorder only" />
                Below reorder
              </span>
              <span className="flex items-center gap-2 text-sm text-neutral-700">
                <Switch checked={showInactive} onChange={setShowInactive} label="Show items no longer in use" />
                Not in use
              </span>
            </div>
          }
        />
      </div>

      {dialog?.kind === "item" && <ItemDialog item={dialog.item} categories={desk.categories} vendors={vendors} onDone={done} onClose={() => setDialog(null)} />}
      {dialog?.kind === "store" && <StoreDialog store={dialog.store} onDone={done} onClose={() => setDialog(null)} />}
      {dialog?.kind === "receive" && <ReceiveDialog desk={desk} itemId={dialog.itemId} onDone={done} onClose={() => setDialog(null)} />}
      {dialog?.kind === "transfer" && <TransferDialog desk={desk} itemId={dialog.itemId} onDone={done} onClose={() => setDialog(null)} />}
      {ledger && <StockLedgerDrawer item={ledger} stores={storeNames} onClose={() => setLedger(null)} />}
      {error && desk && <ErrorNote className="mt-4">{error}</ErrorNote>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function WhereItSits({ desk }: { desk: Desk }) {
  const top = [...desk.items].filter((i) => i.active && i.onHand > 0).sort((a, b) => b.value - a.value).slice(0, 12);
  const active = desk.stores.filter((s) => s.active || top.some((i) => (i.byStore[s.id] ?? 0) > 0));
  if (top.length === 0) return <p className="py-10 text-center text-sm text-neutral-500">Nothing on hand yet. Receive the opening stock to see it here.</p>;
  if (active.length > 1) {
    return (
      <Heatmap
        rows={top.map((i) => i.name)}
        cols={active.map((s) => s.name)}
        cells={top.flatMap((i) => active.map((s) => ({ row: i.name, col: s.name, value: i.byStore[s.id] ?? null })))}
        hue="sky"
        format={(v) => qty(v)}
        caption="On hand by item and store, for the most valuable items"
      />
    );
  }
  return (
    <ColumnChart
      data={top.map((i) => ({ label: i.code, value: i.value, hue: categoryHue(i.category) }))}
      format={(v) => compact(v)}
      caption="Stock value of the most valuable items"
      height={220}
    />
  );
}

function StoresPanel({ stores: rows, items, canAdd, canEdit, onAdd, onEdit }: { stores: StoreRow[]; items: StockItem[]; canAdd: boolean; canEdit: boolean; onAdd: () => void; onEdit: (s: StoreRow) => void }) {
  return (
    <Panel
      title="Stores"
      subtitle={`${rows.filter((s) => s.active).length} open`}
      icon={Warehouse}
      hue="mint"
      actions={
        canAdd && (
          <Button size="sm" icon={Plus} onClick={onAdd}>
            Add store
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <Empty icon={Warehouse} title="No stores yet" hint="Add the store your consumables are kept in. Items are received into it and issued from it." hue="mint" />
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => {
            const held = items.filter((i) => (i.byStore[s.id] ?? 0) > 0);
            const worth = held.reduce((sum, i) => sum + Math.round((i.byStore[s.id] ?? 0) * i.avgCost), 0);
            return (
              <li key={s.id} className={cx("flex items-start gap-3 rounded-2xl border px-3 py-3", s.active ? "border-neutral-200" : "border-dashed border-neutral-200 bg-neutral-50/60")}>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-mint-700">
                  <Warehouse size={16} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-neutral-900">
                    {s.name}
                    {!s.active && <Chip hue="slate">Closed</Chip>}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                    {s.location && (
                      <>
                        <MapPin size={12} aria-hidden /> {s.location} ·{" "}
                      </>
                    )}
                    {s.officer ?? "No officer named"}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-neutral-600">
                    {held.length} {held.length === 1 ? "item" : "items"} · <Money value={worth} className="font-semibold text-neutral-800" />
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(s)}
                    aria-label={`Edit ${s.name}`}
                    className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <Pencil size={15} aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function ItemsTable({
  desk,
  items,
  can,
  onLedger,
  onEdit,
  onReceive,
  toolbar,
}: {
  desk: Desk;
  items: StockItem[];
  can: { editItem: boolean; receive: boolean };
  onLedger: (i: StockItem) => void;
  onEdit: (i: StockItem) => void;
  onReceive: (i: StockItem) => void;
  toolbar: React.ReactNode;
}) {
  const shownStores = desk.stores.filter((s) => s.active || desk.items.some((i) => (i.byStore[s.id] ?? 0) > 0));
  const columns: Column<StockItem>[] = [
    {
      key: "name",
      header: "Item",
      primary: true,
      sortable: true,
      value: (i) => `${i.name} ${i.code}`,
      render: (i) => (
        <span className="block min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-neutral-900">{i.name}</span>
            {i.critical && <Chip hue="rose" className="!px-2 !py-0.5 text-[11px]">Critical</Chip>}
            {!i.active && <Chip hue="slate" className="!px-2 !py-0.5 text-[11px]">Not in use</Chip>}
          </span>
          <span className="block font-mono text-[12px] text-neutral-500">{i.code}</span>
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      hideOnMobile: true,
      value: (i) => desk.categories[i.category] ?? i.category,
      render: (i) => (
        <Chip hue={categoryHue(i.category)} dot>
          {desk.categories[i.category] ?? i.category}
        </Chip>
      ),
    },
    ...shownStores.map<Column<StockItem>>((s) => ({
      key: `store-${s.id}`,
      header: s.name,
      align: "right",
      sortable: true,
      hideOnMobile: true,
      value: (i) => i.byStore[s.id] ?? 0,
      render: (i) => <span className={cx("tabular-nums", (i.byStore[s.id] ?? 0) > 0 ? "text-neutral-800" : "text-neutral-400")}>{qty(i.byStore[s.id] ?? 0)}</span>,
    })),
    {
      key: "onHand",
      header: shownStores.length > 1 ? "Total" : "On hand",
      align: "right",
      sortable: true,
      value: (i) => i.onHand,
      render: (i) => (
        <span className="font-semibold tabular-nums text-neutral-900">
          {qty(i.onHand)} <span className="font-normal text-neutral-500">{i.unit}</span>
        </span>
      ),
    },
    { key: "value", header: "Value", align: "right", sortable: true, value: (i) => i.value, render: (i) => <Money value={i.value} className="tabular-nums" /> },
    {
      key: "level",
      header: "Level",
      sortable: true,
      value: (i) => (i.reorderLevel > 0 ? i.onHand / i.reorderLevel : 99),
      render: (i) => (
        <span className="flex min-w-[140px] items-center gap-2">
          <LevelGauge item={i} className="flex-1" />
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-500">{i.reorderLevel > 0 ? `@ ${qty(i.reorderLevel)}` : "-"}</span>
        </span>
      ),
    },
    {
      key: "state",
      header: "Reorder",
      sortable: true,
      value: (i) => (i.belowReorder ? 0 : 1),
      render: (i) =>
        i.belowReorder ? (
          <span className="flex flex-col items-start gap-1">
            <Chip hue={i.critical ? "rose" : "coral"} icon={TriangleAlert}>
              Below reorder
            </Chip>
            {i.onOrder > 0 && <span className="text-[11px] tabular-nums text-neutral-500">{qty(i.onOrder)} on order</span>}
          </span>
        ) : (
          <span className="text-xs text-neutral-500">{i.reorderLevel > 0 ? "Stocked" : "Not tracked"}</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      tableOnly: true,
      render: (i) => (
        <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconAction label={`Stock ledger of ${i.name}`} icon={History} onClick={() => onLedger(i)} />
          {can.receive && i.active && <IconAction label={`Receive ${i.name}`} icon={PackagePlus} onClick={() => onReceive(i)} />}
          {can.editItem && <IconAction label={`Edit ${i.name}`} icon={Pencil} onClick={() => onEdit(i)} />}
        </span>
      ),
    },
  ];

  /* The items as listed: the filters, the search and the sort; one column per store. */
  const exportCsv = (list: StockItem[]) =>
    downloadCsv(csvName("stock"), [
      ["Code", "Name", "Category", "Unit", ...shownStores.map((s) => s.name), "On hand", "Average cost", "Value", "Currency", "Reorder level", "Reorder quantity", "Below reorder", "On order", "Critical", "In use"],
      ...list.map((i) => [
        i.code,
        i.name,
        desk.categories[i.category] ?? i.category,
        i.unit,
        ...shownStores.map((s) => i.byStore[s.id] ?? 0),
        i.onHand,
        csvAmount(i.avgCost),
        csvAmount(i.value),
        "NGN",
        i.reorderLevel,
        i.reorderQty,
        i.belowReorder ? "Yes" : "No",
        i.onOrder,
        i.critical ? "Yes" : "No",
        i.active ? "Yes" : "No",
      ]),
    ]);

  return (
    <section aria-labelledby="stock-items">
      <h2 id="stock-items" className="mb-3 text-[15px] font-semibold text-neutral-900">
        Items
      </h2>
      {desk.items.length === 0 ? (
        <Card>
          <Empty icon={ClipboardList} title="No items yet" hint="Add the consumables your stores hold (paper, toner, refreshments), then receive their opening stock." />
        </Card>
      ) : (
        <DataView
          rows={items}
          columns={columns}
          rowKey={(i) => i.id}
          onRowClick={onLedger}
          views={["table", "list"]}
          storageKey="operations.stores.items"
          caption="Stock items"
          searchPlaceholder="Search by name or code"
          toolbar={toolbar}
          onDownload={exportCsv}
          empty={<Empty icon={ClipboardList} title="Nothing matches" hint="Clear the filters to see every item." />}
        />
      )}
    </section>
  );
}

function IconAction({ label, icon: Icon, onClick }: { label: string; icon: typeof Pencil; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}
