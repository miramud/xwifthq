"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, ClipboardList, FolderKanban, ListPlus, Package, Paperclip, Save, Send, Trash2, Wrench } from "lucide-react";
import { Button, Card, PageHeader, Panel, Segmented, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Field, FormActions, Skeleton, Switch, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amountInput, parseAmount } from "@/suite/finance/lib/format";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { useAuth } from "@/lib/auth-store";
import { fundsCode, opsError, opsFieldErrors, procurement, type FundsCode, type MeOptions, type PrFull } from "@/lib/api/operations-procurement-client";
import { stores, type AssetCategoryOption, type Catalogue } from "@/lib/api/operations-stores-client";
import { today } from "@/suite/operations/components/procurement/meta";
import { BLANK, estimate, fromRequest, lineEstimate, newLine, toInput, type FormErrors, type LineForm, type PrForm, type PutAway } from "./form";
import FundsRefusal from "./FundsRefusal";
import MyRequestFiles from "./MyRequestFiles";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Raise a purchase request, or finish a draft: what is needed, line by line
 * (goods, or a service described in words), roughly what each costs, which
 * project or cost centre pays, and why. The estimate adds up as it is typed.
 * Sending it starts the approval; a project that can't fund it is said so,
 * and the MD may send it anyway with a reason.
 */

const MAIN_FIELDS = new Set(["title", "category", "funding", "neededBy", "location", "justification", "singleSourceReason", "lines"]);

function apiErrors(e: unknown, form: PrForm): FormErrors {
  const f = opsFieldErrors(e);
  const out: FormErrors = {};
  for (const [k, v] of Object.entries(f)) {
    const m = /^lines\.(\d+)\./.exec(k);
    if (m && form.lines[Number(m[1])]) out[`line.${form.lines[Number(m[1])].key}`] = v;
    else if (k === "projectId" || k === "costCentreId") out.funding = v;
    else if (MAIN_FIELDS.has(k)) out[k] = v;
    else out.general = out.general ?? v;
  }
  if (Object.keys(out).length === 0) out.general = opsError(e);
  return out;
}

export default function PurchaseRequestEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params?.get("id") ?? null;
  const { user } = useAuth();
  const mayOverride = mayDo(user, "memos", "override");

  const [options, setOptions] = useState<MeOptions | null>(null);
  const [pr, setPr] = useState<PrFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState<PrForm>(() => ({ ...BLANK, lines: [newLine()] }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [funds, setFunds] = useState<{ code: FundsCode; message: string } | null>(null);
  const created = useRef<string | null>(null);
  // Where goods can be put away on receipt. Optional: a failure just hides the choice.
  const [stockItems, setStockItems] = useState<Catalogue["items"]>([]);
  const [assetCategories, setAssetCategories] = useState<AssetCategoryOption[]>([]);

  useEffect(() => {
    let alive = true;
    stores.me.catalogue().then(
      (c) => alive && setStockItems(c.items),
      () => undefined,
    );
    stores.me.assetCategories().then(
      (c) => alive && setAssetCategories(c.filter((x) => x.active !== false)),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (editId && created.current === editId) return;
    let alive = true;
    Promise.all([procurement.me.options(), editId ? procurement.me.get(editId) : Promise.resolve(null)])
      .then(([o, p]) => {
        if (!alive) return;
        if (p && p.status !== "draft") {
          router.replace(`/suite/operations/my/requests/${p.id}`);
          return;
        }
        setOptions(o);
        setPr(p);
        if (p) setForm(fromRequest(p));
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(`The request form didn't load. ${opsError(e)}`));
    return () => {
      alive = false;
    };
  }, [editId, reload, router]);

  const set = <K extends keyof PrForm>(k: K, v: PrForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(null);
  };
  const setLine = (key: string, patch: Partial<LineForm>) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
    setSaved(null);
  };

  const totals = estimate(form.lines);
  const projects: SelectOption[] = useMemo(() => (options?.projects ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined })), [options]);
  const costCentres: SelectOption[] = useMemo(() => (options?.costCentres ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })), [options]);
  const categories: SelectOption[] = useMemo(() => Object.entries(options?.prCategories ?? {}).map(([value, label]) => ({ value, label, group: value.startsWith("goods") ? "Goods" : "Services" })), [options]);
  const itemOptions: SelectOption[] = useMemo(() => stockItems.map((i) => ({ value: i.id, label: i.name, hint: `${i.code} · ${i.unit}` })), [stockItems]);
  const assetOptions: SelectOption[] = useMemo(() => assetCategories.map((c) => ({ value: c.id, label: c.name, hint: c.code })), [assetCategories]);
  const putAwayChoices = useMemo(() => {
    const out: { key: PutAway; label: string }[] = [{ key: "none", label: "Not tracked" }];
    if (assetOptions.length) out.push({ key: "asset", label: "An asset" });
    if (itemOptions.length) out.push({ key: "stock", label: "Stock" });
    return out;
  }, [assetOptions, itemOptions]);

  const save = useCallback(async (): Promise<PrFull | null> => {
    const { input, errors: local } = toInput(form);
    if (!input) {
      setErrors(local);
      return null;
    }
    setErrors({});
    try {
      const p = pr ? await procurement.me.update(pr.id, input) : await procurement.me.create(input);
      setPr(p);
      if (!pr) {
        created.current = p.id;
        router.replace(`/suite/operations/my/requests/new?id=${p.id}`);
      }
      return p;
    } catch (e) {
      setErrors(apiErrors(e, form));
      return null;
    }
  }, [form, pr, router]);

  /** Files change on their own routes; only the list is refreshed, so nothing typed is lost. */
  const refreshFiles = useCallback(() => {
    if (!pr) return;
    procurement.me.get(pr.id).then(
      (p) => setPr((cur) => (cur ? { ...cur, attachments: p.attachments } : cur)),
      () => undefined,
    );
  }, [pr]);

  const onSave = async () => {
    setBusy("save");
    setFunds(null);
    const p = await save();
    setBusy(null);
    if (p) setSaved("Draft saved. Send it for approval when it is ready.");
  };

  const send = async (overrideReason?: string) => {
    setBusy("send");
    const p = await save();
    if (!p) {
      setBusy(null);
      return;
    }
    try {
      await procurement.me.submit(p.id, overrideReason ?? null);
      router.push(`/suite/operations/my/requests/${p.id}?sent=1`);
    } catch (e) {
      const code = fundsCode(e);
      if (code) {
        setFunds({ code, message: opsError(e) });
      } else {
        const errs = apiErrors(e, form);
        if (!errs.general) errs.general = `It wasn't sent. ${Object.values(errs)[0]}`;
        setErrors(errs);
      }
      setBusy(null);
    }
  };

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/operations/my/requests" label="My purchase requests" />
        <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />
      </div>
    );

  if (!options)
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the request form…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[420px]" />
      </div>
    );

  const goodsPct = totals.total > 0 ? (totals.goods / totals.total) * 100 : 0;

  return (
    <div>
      <BackLink href="/suite/operations/my/requests" label="My purchase requests" />
      <PageHeader
        eyebrow={pr?.number ?? (pr ? "Draft" : "New purchase request")}
        title={pr ? form.title || "Untitled request" : "Ask to buy something"}
        subtitle="Say what is needed and roughly what it costs. Once approved, procurement finds the vendors and raises the order."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="What it is" icon={ClipboardList} hue="grape">
            <div className="space-y-4">
              <Field id="pr-title" label="Title" hint="Required">
                <input
                  id="pr-title"
                  className={inputClass}
                  value={form.title}
                  maxLength={255}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Laptops for the portal developers"
                  aria-invalid={errors.title ? true : undefined}
                  aria-describedby={errors.title ? "pr-title-err" : undefined}
                />
                <FieldError id="pr-title-err" message={errors.title} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="pr-category" label="Category" hint="Required">
                  <SearchableSelect
                    id="pr-category"
                    value={form.category}
                    onChange={(v) => set("category", v)}
                    options={categories}
                    placeholder="Choose the kind of purchase"
                    searchPlaceholder="Search categories"
                    aria-invalid={errors.category ? true : undefined}
                  />
                  <FieldError message={errors.category} />
                </Field>
                <Field id="pr-needed" label="Needed by" hint="Optional">
                  <input id="pr-needed" type="date" min={today()} className={inputClass} value={form.neededBy} onChange={(e) => set("neededBy", e.target.value)} />
                  <FieldError message={errors.neededBy} />
                </Field>
              </div>
              <Field id="pr-location" label="Deliver to" hint="Optional">
                <input id="pr-location" className={inputClass} value={form.location} maxLength={255} onChange={(e) => set("location", e.target.value)} placeholder="ICT Centre, Main Campus" />
              </Field>
              <Field id="pr-why" label="Why it is needed" hint="Approvers read this first">
                <RichTextEditor
                  id="pr-why"
                  variant="full"
                  minHeight={180}
                  value={form.justification}
                  onChange={(html) => set("justification", html)}
                  placeholder="What it is for, why now, and what happens if it doesn't arrive in time."
                />
                <FieldError message={errors.justification} />
              </Field>
            </div>
          </Panel>

          <Panel
            title="What to buy"
            subtitle="Goods, or a service described in words. Estimates are fine; vendors quote the real prices."
            icon={ListPlus}
            hue="blue"
            actions={
              <span className="hidden text-sm sm:inline">
                <Money value={totals.total} className="font-bold text-neutral-900" />
              </span>
            }
          >
            <ol className="space-y-3">
              {form.lines.map((l, i) => {
                const err = errors[`line.${l.key}`];
                return (
                  <li key={l.key} className={cx("rounded-2xl border p-4", err ? "border-error-500/40 bg-error-500/[0.02]" : "border-neutral-200/80 bg-white")}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cx("flex h-9 w-9 items-center justify-center rounded-xl", l.kind === "service" ? HUE.grape.soft : HUE.sky.soft)}>
                          {l.kind === "service" ? <Wrench size={16} aria-hidden /> : <Package size={16} aria-hidden />}
                        </span>
                        <span className="text-sm font-semibold text-neutral-900">Line {i + 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Segmented
                          label={`Line ${i + 1} is`}
                          value={l.kind}
                          onChange={(k) => setLine(l.key, { kind: k, unit: l.unit === (l.kind === "service" ? "job" : "each") ? (k === "service" ? "job" : "each") : l.unit })}
                          options={[
                            { key: "goods", label: "Goods" },
                            { key: "service", label: "Service" },
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() => set("lines", form.lines.filter((x) => x.key !== l.key))}
                          disabled={form.lines.length === 1}
                          aria-label={`Remove line ${i + 1}`}
                          className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`pr-desc-${l.key}`} className="mb-1 block text-xs font-medium text-neutral-600">
                        {l.kind === "service" ? "The service" : "The item"}, line {i + 1}
                      </label>
                      <input
                        id={`pr-desc-${l.key}`}
                        className={inputClass}
                        value={l.description}
                        maxLength={255}
                        onChange={(e) => setLine(l.key, { description: e.target.value })}
                        placeholder={l.kind === "service" ? "Quarterly servicing of the 200 kVA generator" : "Laptop, 14-inch, 16GB RAM, 512GB SSD"}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[96px_110px_1fr_auto] sm:items-end">
                      <div>
                        <label htmlFor={`pr-qty-${l.key}`} className="mb-1 block text-xs font-medium text-neutral-600">
                          Quantity, line {i + 1}
                        </label>
                        <input id={`pr-qty-${l.key}`} inputMode="decimal" className={cx(inputClass, "text-right tabular-nums")} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor={`pr-unit-${l.key}`} className="mb-1 block text-xs font-medium text-neutral-600">
                          Unit, line {i + 1}
                        </label>
                        <input id={`pr-unit-${l.key}`} className={inputClass} value={l.unit} maxLength={24} onChange={(e) => setLine(l.key, { unit: e.target.value })} placeholder="each" />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label htmlFor={`pr-price-${l.key}`} className="mb-1 block text-xs font-medium text-neutral-600">
                          Estimated unit price (₦), line {i + 1}
                        </label>
                        <input
                          id={`pr-price-${l.key}`}
                          inputMode="decimal"
                          className={cx(inputClass, "text-right tabular-nums")}
                          value={l.price}
                          onChange={(e) => setLine(l.key, { price: e.target.value })}
                          onBlur={() => {
                            const p = parseAmount(l.price);
                            if (p !== null) setLine(l.key, { price: amountInput(p) || "0.00" });
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <p className="col-span-2 text-right sm:col-span-1 sm:pb-3" aria-live="polite">
                        <span className="sr-only">Line {i + 1} estimate </span>
                        <Money value={lineEstimate(l)} className="text-[15px] font-bold text-neutral-900" />
                      </p>
                    </div>
                    {l.kind === "goods" && (putAwayChoices.length > 1 || l.putAway !== "none") && (
                      <div className="mt-3 rounded-2xl bg-neutral-50/80 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-medium text-neutral-600">On arrival, line {i + 1} is</p>
                          <Segmented
                            label={`On arrival, line ${i + 1} is`}
                            value={l.putAway}
                            onChange={(v) => setLine(l.key, { putAway: v })}
                            options={putAwayChoices.some((c) => c.key === l.putAway) ? putAwayChoices : [...putAwayChoices, { key: l.putAway, label: l.putAway === "asset" ? "An asset" : "Stock" }]}
                          />
                        </div>
                        {l.putAway === "asset" && (
                          <div className="mt-2">
                            <label htmlFor={`pr-ac-${l.key}`} className="mb-1 block text-xs font-medium text-neutral-600">
                              Asset category, line {i + 1}
                            </label>
                            <SearchableSelect
                              id={`pr-ac-${l.key}`}
                              value={l.assetCategoryId}
                              onChange={(v) => setLine(l.key, { assetCategoryId: v })}
                              options={assetOptions}
                              placeholder="Choose the asset category"
                              searchPlaceholder="Search categories"
                              noOptionsText="No asset categories yet."
                            />
                            <p className="mt-1 text-[11px] text-neutral-500">Each one received goes on the asset register, with its serial number.</p>
                          </div>
                        )}
                        {l.putAway === "stock" && (
                          <div className="mt-2">
                            <label htmlFor={`pr-item-${l.key}`} className="mb-1 block text-xs font-medium text-neutral-600">
                              Stock item, line {i + 1}
                            </label>
                            <SearchableSelect
                              id={`pr-item-${l.key}`}
                              value={l.itemId}
                              onChange={(v) => {
                                const item = stockItems.find((x) => x.id === v);
                                setLine(l.key, {
                                  itemId: v,
                                  ...(item && !l.description.trim() ? { description: item.name } : {}),
                                  ...(item && (l.unit === "each" || !l.unit.trim()) ? { unit: item.unit } : {}),
                                });
                              }}
                              options={itemOptions}
                              placeholder="Choose the stock item"
                              searchPlaceholder="Search by name or code"
                              noOptionsText="The stores list no items yet."
                            />
                            <p className="mt-1 text-[11px] text-neutral-500">What is received goes into the store as this item.</p>
                          </div>
                        )}
                      </div>
                    )}
                    <FieldError message={err} />
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" icon={Package} onClick={() => set("lines", [...form.lines, newLine("goods")])} disabled={form.lines.length >= 100}>
                Add goods
              </Button>
              <Button size="sm" icon={Wrench} onClick={() => set("lines", [...form.lines, newLine("service")])} disabled={form.lines.length >= 100}>
                Add a service
              </Button>
            </div>
            <FieldError message={errors.lines} />
          </Panel>

          <Panel title="Which budget pays" subtitle="Every purchase is charged to a project or a cost centre" icon={FolderKanban} hue="sky">
            <div className="mb-4">
              <Segmented
                label="Charge to"
                value={form.funding}
                onChange={(v) => set("funding", v)}
                options={[
                  { key: "project", label: "Project" },
                  { key: "costCentre", label: "Cost centre" },
                ]}
              />
            </div>
            {form.funding === "project" ? (
              <Field id="pr-project" label="Project">
                <SearchableSelect
                  id="pr-project"
                  value={form.projectId}
                  onChange={(v) => set("projectId", v)}
                  options={projects}
                  placeholder="Choose the project"
                  searchPlaceholder="Search projects"
                  noOptionsText="No projects in this organisation."
                  aria-invalid={errors.funding ? true : undefined}
                />
              </Field>
            ) : (
              <Field id="pr-cc" label="Cost centre">
                <SearchableSelect
                  id="pr-cc"
                  value={form.costCentreId}
                  onChange={(v) => set("costCentreId", v)}
                  options={costCentres}
                  placeholder="Choose the cost centre"
                  searchPlaceholder="Search cost centres"
                  noOptionsText="No cost centres yet. Ask Finance to set them up."
                  aria-invalid={errors.funding ? true : undefined}
                />
              </Field>
            )}
            <FieldError message={errors.funding} />
            {form.funding === "project" && options.financeOn && <p className="mt-2 text-xs text-neutral-500">The project&apos;s funds are checked when you send it.</p>}
          </Panel>

          <Panel title="Only one vendor?" subtitle="Above the threshold, three quotations are needed unless a single source is justified" icon={BadgeCheck} hue="sun">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Only one vendor can supply this</p>
                <p className="text-xs text-neutral-500">A sole distributor, a licence holder, a warranty that requires it.</p>
              </div>
              <Switch checked={form.singleSource} onChange={(v) => set("singleSource", v)} label="Only one vendor can supply this" />
            </div>
            {form.singleSource && (
              <Field id="pr-ss" label="Why only this vendor" className="mt-4">
                <textarea id="pr-ss" rows={3} className={textareaClass} value={form.singleSourceReason} onChange={(e) => set("singleSourceReason", e.target.value)} aria-invalid={errors.singleSourceReason ? true : undefined} />
                <FieldError message={errors.singleSourceReason} />
              </Field>
            )}
          </Panel>

          {pr ? (
            <MyRequestFiles pr={pr} onChange={refreshFiles} />
          ) : (
            <Panel title="Files" subtitle="Optional. Nothing waits on them." icon={Paperclip} hue="sky">
              <p className="text-sm text-neutral-600">Save the draft first to add a specification, a sample design or an agenda. The request can go without one.</p>
            </Panel>
          )}
        </div>

        <aside className="min-w-0" aria-label="Estimate">
          <Card className="p-5 xl:sticky xl:top-20">
            <p className="text-sm font-semibold text-neutral-500">Estimated total</p>
            <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900" aria-live="polite">
              <Money value={totals.total} />
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {form.lines.length} {form.lines.length === 1 ? "line" : "lines"}, before VAT
            </p>
            <div className="ws-hatch mt-4 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
              <span className="h-full bg-sky-500" style={{ width: `${goodsPct}%` }} />
              <span className="h-full bg-grape-500" style={{ width: `${totals.total > 0 ? 100 - goodsPct : 0}%` }} />
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-neutral-600">
                  <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
                  Goods
                </dt>
                <dd>
                  <Money value={totals.goods} className="font-semibold text-neutral-800" />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-neutral-600">
                  <span className="h-2 w-2 rounded-full bg-grape-500" aria-hidden />
                  Services
                </dt>
                <dd>
                  <Money value={totals.services} className="font-semibold text-neutral-800" />
                </dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>

      <div className="mt-6 space-y-3">
        {funds && <FundsRefusal code={funds.code} message={funds.message} canOverride={mayOverride} busy={busy === "send"} onOverride={(r) => void send(r)} />}
        {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
        {saved && (
          <p role="status" className="rounded-2xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">
            {saved}
          </p>
        )}
        <FormActions note="Approvers see the estimate and, for a project, its funds at the moment you send it.">
          <Button icon={Save} onClick={() => void onSave()} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </Button>
          <Button variant="primary" icon={Send} onClick={() => void send()} disabled={busy !== null}>
            {busy === "send" ? "Sending…" : "Send for approval"}
          </Button>
        </FormActions>
      </div>
    </div>
  );
}
