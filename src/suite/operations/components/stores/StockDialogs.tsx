"use client";

import { useId, useMemo, useState } from "react";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, PersonSelect } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { opsError, opsFieldErrors } from "@/lib/api/operations-procurement-client";
import { stores, type ItemInput, type StockDesk, type StockItem, type StoreRow } from "@/lib/api/operations-stores-client";
import { parseQty, qty } from "@/suite/operations/components/procurement/meta";

/* The stock desk's forms: an item, a store, stock received by hand, and a transfer between stores. */

type Errors = Record<string, string>;

function apiErrors(e: unknown): Errors {
  const f = opsFieldErrors(e);
  return Object.keys(f).length ? f : { general: opsError(e) };
}

function Footer({ onClose, busy, label, busyLabel }: { onClose: () => void; busy: boolean; label: string; busyLabel: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? busyLabel : label}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Item                                                               */
/* ------------------------------------------------------------------ */

export function ItemDialog({
  item,
  categories,
  vendors,
  onDone,
  onClose,
}: {
  item: StockItem | null;
  categories: Record<string, string>;
  vendors: SelectOption[];
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "each");
  const [level, setLevel] = useState(item ? String(item.reorderLevel) : "");
  const [reorderQty, setReorderQty] = useState(item ? String(item.reorderQty) : "");
  const [critical, setCritical] = useState(item?.critical ?? false);
  const [active, setActive] = useState(item?.active ?? true);
  const [vendor, setVendor] = useState(item?.preferredVendorId ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const categoryOptions = useMemo(() => Object.entries(categories).map(([value, label]) => ({ value, label })), [categories]);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!code.trim()) local.code = "Give the item a short code, like STA-001.";
    if (!name.trim()) local.name = "Name the item.";
    if (!category) local.category = "Choose a category.";
    const lv = level.trim() ? parseQty(level) : 0;
    const rq = reorderQty.trim() ? parseQty(reorderQty) : 0;
    if (lv === null) local.reorderLevel = "The reorder level is a number, like 20 or 2.5.";
    if (rq === null) local.reorderQty = "The reorder quantity is a number, like 50.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const input: ItemInput = {
      code: code.trim(),
      name: name.trim(),
      category,
      unit: unit.trim() || "each",
      reorderLevel: lv ?? 0,
      reorderQty: rq ?? 0,
      critical,
      preferredVendorId: vendor || null,
      ...(item ? { active } : {}),
    };
    setBusy(true);
    setErrors({});
    try {
      if (item) await stores.updateItem(item.id, input);
      else await stores.createItem(input);
      onDone(item ? `${input.name} saved.` : `${input.name} added to the item master. Receive its opening stock next.`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={item ? `Edit ${item.name}` : "Add an item"}
      subtitle="Consumables the stores hold and issue. The reorder level is when a restock is suggested."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={item ? "Save item" : "Add item"} busyLabel="Saving…" />}
    >
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Field id={`${uid}-code`} label="Code">
          <input id={`${uid}-code`} className={cx(inputClass, "font-mono uppercase")} value={code} maxLength={40} onChange={(e) => setCode(e.target.value)} placeholder="STA-001" aria-invalid={errors.code ? true : undefined} />
          <FieldError message={errors.code} />
        </Field>
        <Field id={`${uid}-name`} label="Name">
          <input id={`${uid}-name`} className={inputClass} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="A4 paper, 80gsm" aria-invalid={errors.name ? true : undefined} />
          <FieldError message={errors.name} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field id={`${uid}-cat`} label="Category">
          <SearchableSelect id={`${uid}-cat`} value={category} onChange={setCategory} options={categoryOptions} placeholder="Choose a category" searchPlaceholder="Search categories" aria-invalid={errors.category ? true : undefined} />
          <FieldError message={errors.category} />
        </Field>
        <Field id={`${uid}-unit`} label="Unit">
          <input id={`${uid}-unit`} className={inputClass} value={unit} maxLength={24} onChange={(e) => setUnit(e.target.value)} placeholder="ream" />
          <FieldError message={errors.unit} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-lv`} label="Reorder level" hint="Restock at or below this">
          <input id={`${uid}-lv`} inputMode="decimal" className={cx(inputClass, "text-right tabular-nums")} value={level} onChange={(e) => setLevel(e.target.value)} placeholder="0" aria-invalid={errors.reorderLevel ? true : undefined} />
          <FieldError message={errors.reorderLevel} />
        </Field>
        <Field id={`${uid}-rq`} label="Reorder quantity" hint="How many to buy">
          <input id={`${uid}-rq`} inputMode="decimal" className={cx(inputClass, "text-right tabular-nums")} value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} placeholder="0" aria-invalid={errors.reorderQty ? true : undefined} />
          <FieldError message={errors.reorderQty} />
        </Field>
      </div>
      <Field id={`${uid}-vendor`} label="Preferred vendor" hint="Optional">
        <SearchableSelect id={`${uid}-vendor`} value={vendor} onChange={setVendor} options={vendors} clearable clearLabel="No preferred vendor" placeholder="Choose a vendor" searchPlaceholder="Search vendors" noOptionsText="No vendors yet." />
        <FieldError message={errors.preferredVendorId} />
      </Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Critical item</p>
            <p className="text-xs text-neutral-500">Running out stops work. Critical items go to the top of the reorder list.</p>
          </div>
          <Switch checked={critical} onChange={setCritical} label="Critical item" />
        </div>
        {item && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">In use</p>
              <p className="text-xs text-neutral-500">Switched off, staff can no longer ask for it. Its history stays.</p>
            </div>
            <Switch checked={active} onChange={setActive} label="Item in use" />
          </div>
        )}
      </div>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

export function StoreDialog({ store, onDone, onClose }: { store: StoreRow | null; onDone: (message: string) => void; onClose: () => void }) {
  const uid = useId();
  const [name, setName] = useState(store?.name ?? "");
  const [location, setLocation] = useState(store?.location ?? "");
  const [officer, setOfficer] = useState(store?.officerId ?? "");
  const [active, setActive] = useState(store?.active ?? true);
  const [threshold, setThreshold] = useState(amountInput(store?.varianceAlertValue ?? null));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const defaultThreshold = store?.varianceAlertDefault ?? 5_000_000;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const limit = threshold.trim() ? parseAmount(threshold) : null;
    if (!name.trim()) {
      setErrors({ name: "Name the store." });
      return;
    }
    if (threshold.trim() && limit === null) {
      setErrors({ varianceAlertValue: "Type an amount, like 50,000.00, or leave it empty for the default." });
      return;
    }
    setBusy(true);
    setErrors({});
    const input = { name: name.trim(), location: location.trim() || null, officerId: officer || null, varianceAlertValue: limit, ...(store ? { active } : {}) };
    try {
      if (store) await stores.updateStore(store.id, input);
      else await stores.createStore(input);
      onDone(store ? `${input.name} saved.` : `${input.name} added.`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={store ? `Edit ${store.name}` : "Add a store"}
      subtitle="Where stock is kept and issued from, and the officer who runs it."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={store ? "Save store" : "Add store"} busyLabel="Saving…" />}
    >
      <Field id={`${uid}-name`} label="Name">
        <input id={`${uid}-name`} className={inputClass} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="Main store" aria-invalid={errors.name ? true : undefined} />
        <FieldError message={errors.name} />
      </Field>
      <Field id={`${uid}-loc`} label="Where it is" hint="Optional">
        <input id={`${uid}-loc`} className={inputClass} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} placeholder="Ground floor, Admin block" />
      </Field>
      <Field id={`${uid}-officer`} label="Store officer" hint="Optional">
        <PersonSelect id={`${uid}-officer`} value={officer} onChange={setOfficer} clearable placeholder="Choose who runs it" />
        <FieldError message={errors.officerId} />
      </Field>
      <Field id={`${uid}-variance`} label="Count variance to report to Finance (₦)" hint={`Optional · default ₦${(defaultThreshold / 100).toLocaleString("en-NG")}`}>
        <input
          id={`${uid}-variance`}
          className={inputClass}
          inputMode="decimal"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder={amountInput(defaultThreshold)}
          aria-invalid={errors.varianceAlertValue ? true : undefined}
        />
        <FieldError message={errors.varianceAlertValue} />
      </Field>
      {store && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Open</p>
            <p className="text-xs text-neutral-500">A closed store takes no new requisitions. Its stock stays on the books.</p>
          </div>
          <Switch checked={active} onChange={setActive} label="Store open" />
        </div>
      )}
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Receive (opening balance, or stock that came without an order)     */
/* ------------------------------------------------------------------ */

const itemOptions = (desk: StockDesk): SelectOption[] =>
  desk.items.filter((i) => i.active).map((i) => ({ value: i.id, label: i.name, hint: `${i.code} · ${desk.categories[i.category] ?? i.category}` }));
const storeOptions = (desk: StockDesk): SelectOption[] => desk.stores.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name, hint: s.location ?? undefined }));

export function ReceiveDialog({ desk, itemId, onDone, onClose }: { desk: StockDesk; itemId?: string; onDone: (message: string) => void; onClose: () => void }) {
  const uid = useId();
  const [storeId, setStoreId] = useState(desk.stores.filter((s) => s.active).length === 1 ? desk.stores.find((s) => s.active)!.id : "");
  const [item, setItem] = useState(itemId ?? "");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const chosen = desk.items.find((i) => i.id === item) ?? null;
  const q = parseQty(quantity);
  const c = cost.trim() ? parseAmount(cost) : null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!storeId) local.storeId = "Choose the store it went into.";
    if (!item) local.itemId = "Choose the item.";
    if (q === null || q <= 0) local.quantity = "The quantity is a number above 0, like 12 or 2.5.";
    if (cost.trim() && c === null) local.unitCost = "Type the unit cost, like 4,500.00.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const r = await stores.receive({ storeId, itemId: item, quantity: q!, ...(c ? { unitCost: c } : {}) });
      onDone(`${qty(q!)} ${chosen?.unit ?? ""} of ${chosen?.name ?? "the item"} received. ${desk.stores.find((s) => s.id === storeId)?.name ?? "The store"} now holds ${qty(r.balanceAfter)}.`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Receive stock"
      subtitle="An opening balance, or stock that arrived without a purchase order. Deliveries against an order are received on the GRN instead."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Receive stock" busyLabel="Receiving…" />}
    >
      <Field id={`${uid}-store`} label="Into store">
        <SearchableSelect id={`${uid}-store`} value={storeId} onChange={setStoreId} options={storeOptions(desk)} placeholder="Choose a store" searchPlaceholder="Search stores" noOptionsText="Add a store first." aria-invalid={errors.storeId ? true : undefined} />
        <FieldError message={errors.storeId} />
      </Field>
      <Field id={`${uid}-item`} label="Item">
        <SearchableSelect id={`${uid}-item`} value={item} onChange={setItem} options={itemOptions(desk)} placeholder="Choose an item" searchPlaceholder="Search by name or code" noOptionsText="Add an item first." aria-invalid={errors.itemId ? true : undefined} />
        <FieldError message={errors.itemId} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-q`} label={`Quantity${chosen ? ` (${chosen.unit})` : ""}`}>
          <input id={`${uid}-q`} inputMode="decimal" className={cx(inputClass, "text-right tabular-nums")} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" aria-invalid={errors.quantity ? true : undefined} />
          <FieldError message={errors.quantity} />
        </Field>
        <Field id={`${uid}-c`} label="Unit cost (₦)" hint="Optional">
          <input
            id={`${uid}-c`}
            inputMode="decimal"
            className={cx(inputClass, "text-right tabular-nums")}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            onBlur={() => {
              const p = parseAmount(cost);
              if (p !== null) setCost(amountInput(p) || "0.00");
            }}
            placeholder={chosen?.avgCost ? amountInput(chosen.avgCost) : "0.00"}
            aria-invalid={errors.unitCost ? true : undefined}
          />
          <FieldError message={errors.unitCost} />
        </Field>
      </div>
      <p className="text-xs text-neutral-500">
        {chosen ? (
          <>
            Average cost now <Money value={chosen.avgCost} className="font-semibold text-neutral-700" />. A unit cost moves the average. Leave it blank to receive at the current average.
            {q && c ? (
              <>
                {" "}
                This receipt is worth <Money value={Math.round(q * c)} className="font-semibold text-neutral-700" />.
              </>
            ) : null}
          </>
        ) : (
          "A unit cost moves the item's average cost. Leave it blank to receive at the current average."
        )}
      </p>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Transfer                                                           */
/* ------------------------------------------------------------------ */

export function TransferDialog({ desk, itemId, onDone, onClose }: { desk: StockDesk; itemId?: string; onDone: (message: string) => void; onClose: () => void }) {
  const uid = useId();
  const [item, setItem] = useState(itemId ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [quantity, setQuantity] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const chosen = desk.items.find((i) => i.id === item) ?? null;
  const held = chosen && from ? chosen.byStore[from] ?? 0 : null;
  const fromOptions = desk.stores.map((s) => ({ value: s.id, label: s.name, hint: chosen ? `Holds ${qty(chosen.byStore[s.id] ?? 0)} ${chosen.unit}` : s.location ?? undefined }));
  const toOptions = desk.stores.filter((s) => s.active && s.id !== from).map((s) => ({ value: s.id, label: s.name, hint: s.location ?? undefined }));
  const q = parseQty(quantity);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!item) local.itemId = "Choose the item.";
    if (!from) local.fromStoreId = "Choose where it comes from.";
    if (!to) local.toStoreId = "Choose where it goes.";
    else if (to === from) local.toStoreId = "Choose another store.";
    if (q === null || q <= 0) local.quantity = "The quantity is a number above 0.";
    else if (held !== null && q > held) local.quantity = `That store holds only ${qty(held)} ${chosen?.unit ?? ""}.`;
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await stores.transfer({ fromStoreId: from, toStoreId: to, itemId: item, quantity: q! });
      const name = (id: string) => desk.stores.find((s) => s.id === id)?.name ?? "the store";
      onDone(`${qty(q!)} ${chosen?.unit ?? ""} of ${chosen?.name ?? "the item"} moved from ${name(from)} to ${name(to)}.`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Transfer between stores"
      subtitle="Stock moves at its average cost. Both stores' ledgers record it."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Transfer stock" busyLabel="Transferring…" />}
    >
      <Field id={`${uid}-item`} label="Item">
        <SearchableSelect id={`${uid}-item`} value={item} onChange={setItem} options={itemOptions(desk)} placeholder="Choose an item" searchPlaceholder="Search by name or code" aria-invalid={errors.itemId ? true : undefined} />
        <FieldError message={errors.itemId} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-from`} label="From">
          <SearchableSelect id={`${uid}-from`} value={from} onChange={setFrom} options={fromOptions} placeholder="Choose a store" searchPlaceholder="Search stores" aria-invalid={errors.fromStoreId ? true : undefined} />
          <FieldError message={errors.fromStoreId} />
        </Field>
        <Field id={`${uid}-to`} label="To">
          <SearchableSelect id={`${uid}-to`} value={to} onChange={setTo} options={toOptions} placeholder="Choose a store" searchPlaceholder="Search stores" noOptionsText="Add a second store first." aria-invalid={errors.toStoreId ? true : undefined} />
          <FieldError message={errors.toStoreId} />
        </Field>
      </div>
      <Field id={`${uid}-q`} label={`Quantity${chosen ? ` (${chosen.unit})` : ""}`} hint={held !== null ? `${qty(held)} available` : undefined}>
        <input id={`${uid}-q`} inputMode="decimal" className={cx(inputClass, "text-right tabular-nums")} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" aria-invalid={errors.quantity ? true : undefined} />
        <FieldError message={errors.quantity} />
      </Field>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}
