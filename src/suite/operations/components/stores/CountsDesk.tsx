"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardCheck, ClipboardList, Hourglass, Scale, ScanLine, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Card, Empty, PageHeader, Panel, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import type { CalendarEvent } from "@/components/workspace/Calendar";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { opsError, opsFieldErrors } from "@/lib/api/operations-procurement-client";
import { stores, type StockCount, type StockDesk } from "@/lib/api/operations-stores-client";
import { qty } from "@/suite/operations/components/procurement/meta";
import { countStatus } from "./meta";
import { CountStatusChip, ymdOf } from "./ui";
import { StoresCalendar } from "./StoresCalendar";

/**
 * Stock counts (§10.4): a full count of a store, or a cycle count of chosen
 * items. The counter records what is on the shelf; somebody else approves,
 * and only then is the stock adjusted by each variance.
 */

/** A count's net variance value and how many lines are counted. Pure. */
export function countTotals(c: Pick<StockCount, "lines">): { counted: number; total: number; net: number } {
  let counted = 0;
  let net = 0;
  for (const l of c.lines) {
    if (l.countedQty === null) continue;
    counted++;
    net += l.varianceValue ?? 0;
  }
  return { counted, total: c.lines.length, net };
}

export default function CountsDesk() {
  const { user } = useAuth();
  const [rows, setRows] = useState<StockCount[] | null>(null);
  const [desk, setDesk] = useState<StockDesk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([stores.counts.list(), stores.desk().catch(() => null)]).then(
      ([c, d]) => {
        if (!alive) return;
        setRows(c);
        setDesk(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`Stock counts didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const canStart = mayDoOps(user, "stores", "create_count");

  const header = (
    <PageHeader
      eyebrow="Stores"
      title="Stock counts"
      subtitle="Count what is on the shelf. Somebody other than the counter approves, and the stock is adjusted by each difference."
      actions={
        canStart && (
          <Button variant="primary" icon={ScanLine} onClick={() => setStarting(true)} disabled={!desk}>
            Start a count
          </Button>
        )
      }
    />
  );

  if (error && !rows)
    return (
      <div>
        {header}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!rows)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading stock counts…</p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  const open = rows.filter((c) => c.status === "counting");
  const toApprove = rows.filter((c) => c.status === "submitted");
  const approved = rows.filter((c) => c.status === "approved");
  const adjusted = approved.reduce((s, c) => s + countTotals(c).net, 0);

  const events: CalendarEvent[] = rows
    .filter((c) => c.createdAt)
    .map((c) => ({
      id: c.id,
      date: ymdOf(c.createdAt)!,
      title: c.store ?? "Count",
      meta: c.kind === "cycle" ? "Cycle count" : "Full count",
      hue: countStatus(c.status).hue,
      href: `/suite/operations/stores/counts/${c.id}`,
    }));

  const columns: Column<StockCount>[] = [
    {
      key: "store",
      header: "Count",
      primary: true,
      sortable: true,
      value: (c) => `${c.store ?? ""} ${c.countedBy ?? ""}`,
      render: (c) => (
        <span className="block">
          <span className="block font-semibold text-neutral-900">{c.store ?? "A store"}</span>
          <span className="block text-xs text-neutral-500">{c.kind === "cycle" ? "Cycle count" : "Full count"}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", sortable: true, value: (c) => countStatus(c.status).label, render: (c) => <CountStatusChip status={c.status} /> },
    {
      key: "progress",
      header: "Counted",
      sortable: true,
      value: (c) => countTotals(c).counted / Math.max(1, c.lines.length),
      render: (c) => {
        const t = countTotals(c);
        const pct = t.total ? (t.counted / t.total) * 100 : 0;
        return (
          <span className="block min-w-[110px]">
            <span className="block text-xs tabular-nums text-neutral-600">
              {t.counted} of {t.total} lines
            </span>
            <span className="ws-hatch mt-1 block h-1.5 overflow-hidden rounded-full" aria-hidden>
              <span className="block h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
            </span>
          </span>
        );
      },
    },
    {
      key: "variance",
      header: "Variance",
      align: "right",
      sortable: true,
      value: (c) => countTotals(c).net,
      render: (c) => {
        const t = countTotals(c);
        return t.counted ? <Money value={t.net} signed className={cx("font-semibold tabular-nums", t.net < 0 ? "text-coral-700" : t.net > 0 ? "text-mint-700" : "text-neutral-700")} /> : <span className="text-neutral-400">-</span>;
      },
    },
    { key: "by", header: "Counted by", sortable: true, hideOnMobile: true, value: (c) => c.countedBy ?? "" },
    { key: "on", header: "Started", sortable: true, value: (c) => c.createdAt ?? "", render: (c) => <span className="text-sm">{day(c.createdAt)}</span> },
  ];

  return (
    <div>
      {header}
      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="Being counted" value={open.length} icon={ClipboardList} hint={open.length ? open.map((c) => c.store).filter(Boolean).slice(0, 2).join(", ") : "No count open"} />
          <StatCard label="To approve" value={toApprove.length} icon={Hourglass} hue={toApprove.length ? "sun" : "mint"} hint={toApprove.length ? "Submitted by the counter" : "Nothing waiting"} />
          <StatCard label="Approved" value={approved.length} icon={ClipboardCheck} hue="mint" hint="Stock adjusted to the count" />
          <StatCard label="Adjusted by" value={compact(adjusted)} icon={Scale} hue={adjusted < 0 ? "coral" : "sky"} hint="Net value of approved variances" />
        </StatGrid>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="Count calendar" subtitle="Each count on the day it started" icon={CalendarDays} hue="sky">
            <StoresCalendar
              events={events}
              caption="Stock counts started"
              legend={[
                { label: "Counting", hue: "sky" },
                { label: "To approve", hue: "sun" },
                { label: "Approved", hue: "mint" },
                { label: "Rejected", hue: "rose" },
              ]}
            />
          </Panel>
          <Panel title="Waiting for approval" subtitle="Approve someone else's count" icon={Hourglass} hue="sun">
            {toApprove.length === 0 ? (
              <Empty icon={ClipboardCheck} title="Nothing to approve" hint="Submitted counts wait here for somebody other than the counter." hue="mint" />
            ) : (
              <ul className="space-y-2">
                {toApprove.map((c) => {
                  const t = countTotals(c);
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/suite/operations/stores/counts/${c.id}`}
                        className="block rounded-2xl border border-neutral-200 px-3 py-2.5 outline-none transition hover:border-neutral-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-neutral-900">{c.store}</span>
                          <Money value={t.net} signed className={cx("shrink-0 text-sm font-bold tabular-nums", t.net < 0 ? "text-coral-700" : "text-mint-700")} />
                        </span>
                        <span className="block text-xs text-neutral-500">
                          {c.countedBy ?? "Someone"} · {t.total} lines · {day(c.createdAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <section aria-labelledby="counts-list">
          <h2 id="counts-list" className="mb-3 text-[15px] font-semibold text-neutral-900">
            Every count
          </h2>
          {rows.length === 0 ? (
            <Card>
              <Empty icon={ScanLine} title="No counts yet" hint="Start a full count of a store, or a cycle count of the items that move most." />
            </Card>
          ) : (
            <DataView rows={rows} columns={columns} rowKey={(c) => c.id} rowHref={(c) => `/suite/operations/stores/counts/${c.id}`} views={["table", "list"]} storageKey="operations.stores.counts" caption="Stock counts" searchPlaceholder="Search by store or counter" />
          )}
        </section>
      </div>

      {starting && desk && <StartCountDialog desk={desk} onClose={() => setStarting(false)} />}
    </div>
  );
}

function StartCountDialog({ desk, onClose }: { desk: StockDesk; onClose: () => void }) {
  const uid = useId();
  const router = useRouter();
  const [storeId, setStoreId] = useState("");
  const [kind, setKind] = useState<"full" | "cycle">("full");
  const [picked, setPicked] = useState<string[]>([]);
  const [find, setFind] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const held = useMemo(() => desk.items.filter((i) => storeId && i.byStore[storeId] !== undefined), [desk, storeId]);
  const shown = held.filter((i) => !find.trim() || `${i.name} ${i.code}`.toLowerCase().includes(find.trim().toLowerCase()));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Record<string, string> = {};
    if (!storeId) local.storeId = "Choose the store to count.";
    if (kind === "cycle" && picked.length === 0) local.items = "Choose the items to count.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const c = await stores.counts.start({ storeId, kind, ...(kind === "cycle" ? { itemIds: picked } : {}) });
      router.push(`/suite/operations/stores/counts/${c.id}`);
    } catch (e) {
      const f = opsFieldErrors(e);
      setErrors(Object.keys(f).length ? { general: Object.values(f)[0] } : { general: opsError(e) });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Start a count"
      subtitle="The sheet takes each item's figure as it stands now. Issues while you count still stand."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Starting…" : "Start the count"}
          </Button>
        </div>
      }
    >
      <Field id={`${uid}-store`} label="Store">
        <SearchableSelect
          id={`${uid}-store`}
          value={storeId}
          onChange={(v) => {
            setStoreId(v);
            setPicked([]);
          }}
          options={desk.stores.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name, hint: s.location ?? undefined }))}
          placeholder="Choose a store"
          searchPlaceholder="Search stores"
          aria-invalid={errors.storeId ? true : undefined}
        />
        <FieldError message={errors.storeId} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">Kind of count</p>
        <Segmented
          label="Kind of count"
          value={kind}
          onChange={setKind}
          options={[
            { key: "full", label: "Full count" },
            { key: "cycle", label: "Cycle count" },
          ]}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{kind === "full" ? "Every item the store has held." : "Only the items you choose: the fast movers, or the ones that worry you."}</p>
      </div>
      {kind === "cycle" && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">
            Items to count <span className="font-normal text-neutral-500">· {picked.length} chosen</span>
          </legend>
          {!storeId ? (
            <p className="text-sm text-neutral-500">Choose the store first.</p>
          ) : held.length === 0 ? (
            <p className="text-sm text-neutral-500">This store hasn&apos;t held anything yet.</p>
          ) : (
            <>
              <label className="relative mb-2 block">
                <span className="sr-only">Find an item</span>
                <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find an item" className="h-10 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-sm outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100" />
              </label>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-1.5">
                {shown.map((i) => (
                  <li key={i.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        checked={picked.includes(i.id)}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, i.id] : p.filter((x) => x !== i.id)))}
                        className="h-4 w-4 accent-primary-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-neutral-900">{i.name}</span>
                        <span className="block text-xs text-neutral-500">
                          {i.code} · {qty(i.byStore[storeId] ?? 0)} {i.unit} on the books
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <FieldError message={errors.items} />
        </fieldset>
      )}
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}
