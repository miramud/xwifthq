"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { Layers, PackagePlus, PenLine, Plus, Trash2, X } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, Segmented } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Field, Skeleton, Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { getJobTitlesServerState, getJobTitlesState, loadJobTitles, subscribeJobTitles } from "@/lib/api/job-titles-client";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { assets, opsError, opsFieldErrors, type AssetCategory, type AssetClass, type AssetKit, type KitItem } from "@/lib/api/operations-assets-client";
import { ASSET_CLASS, plural } from "./labels";
import { AssetTag } from "./parts";

/**
 * Asset categories (each with its tag code, whether Finance books it as a
 * capital asset and in which class) and the onboarding kits a new starter
 * is given by job title.
 */
export default function CategoriesAndKits() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<AssetCategory[] | null>(null);
  const [kits, setKits] = useState<AssetKit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editingCat, setEditingCat] = useState<AssetCategory | "new" | null>(null);
  const [editingKit, setEditingKit] = useState<AssetKit | "new" | null>(null);
  const [kitError, setKitError] = useState<string | null>(null);
  const titles = useSyncExternalStore(subscribeJobTitles, getJobTitlesState, getJobTitlesServerState);

  useEffect(() => {
    let alive = true;
    Promise.all([assets.categories(), assets.kits()]).then(
      ([c, k]) => {
        if (!alive) return;
        setCategories(c);
        setKits(k);
        setError(null);
      },
      (e: unknown) => alive && setError(`Categories and kits didn't load. ${opsError(e)}`),
    );
    loadJobTitles().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [reload]);

  const titleName = useMemo(() => new Map(titles.titles.map((t) => [t.id, t.name])), [titles.titles]);
  const catById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  if (error && !categories) return <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />;
  if (!categories || !kits) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading categories and kits…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[320px]" />
        <Skeleton className="h-[240px]" />
      </div>
    );
  }

  const canAddCat = mayDoOps(user, "assets", "create_category");
  const canEditCat = mayDoOps(user, "assets", "update_category");
  const canAddKit = mayDoOps(user, "assets", "create_kit");
  const canEditKit = mayDoOps(user, "assets", "update_kit");
  const canDeleteKit = mayDoOps(user, "assets", "delete_kit");

  const removeKit = async (k: AssetKit) => {
    const ok = await confirm({
      title: `Remove the ${k.name} kit?`,
      body: "New starters stop being offered it. Requests already raised from it are not changed. This can't be undone.",
      confirmLabel: "Remove kit",
    });
    if (!ok) return;
    setKitError(null);
    try {
      await assets.deleteKit(k.id);
      setKits((list) => (list ?? []).filter((x) => x.id !== k.id));
    } catch (e) {
      setKitError(opsError(e));
    }
  };

  const columns: Column<AssetCategory>[] = [
    { key: "code", header: "Tag code", sortable: true, value: (c) => c.code, render: (c) => <AssetTag tagNo="0001" code={c.code} size="sm" /> },
    {
      key: "name",
      header: "Category",
      primary: true,
      sortable: true,
      value: (c) => `${c.name} ${c.code}`,
      render: (c) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold text-neutral-900">{c.name}</span>
          {!c.active && <Chip>Not in use</Chip>}
        </span>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      sortable: true,
      value: (c) => c.kind,
      render: (c) => (c.kind === "capital" ? <Chip hue="grape">Capital</Chip> : <Chip hue="sky">Controlled</Chip>),
    },
    { key: "class", header: "Finance class", sortable: true, hideOnMobile: true, value: (c) => (c.assetClass ? ASSET_CLASS[c.assetClass] : "Not on Finance's books") },
    { key: "assets", header: "Assets", align: "right", sortable: true, value: (c) => c.assets ?? 0, render: (c) => <span className="tabular-nums font-semibold">{c.assets ?? 0}</span> },
    ...(canEditCat
      ? [
          {
            key: "edit",
            header: "",
            tableOnly: true,
            align: "right" as const,
            render: (c: AssetCategory) => (
              <Button size="sm" variant="ghost" icon={PenLine} aria-label={`Edit ${c.name}`} onClick={() => setEditingCat(c)}>
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <BackLink href="/suite/operations/assets" label="Asset register" />
      <PageHeader title="Categories and kits" subtitle="What kinds of asset you keep, how each is tagged and booked, and what a new starter is given." />

      <div className="space-y-6">
        <Panel
          title="Asset categories"
          subtitle="Capital assets go onto Finance's books in their class when tagged. Controlled items are tracked here only."
          icon={Layers}
          hue="sky"
          bodyClassName="p-0 pt-4"
          actions={
            canAddCat ? (
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditingCat("new")}>
                Add category
              </Button>
            ) : undefined
          }
        >
          <div className="px-5 pb-5">
            <DataView rows={categories} columns={columns} rowKey={(c) => c.id} views={["table"]} caption="Asset categories" searchPlaceholder="Search categories" empty={<Empty icon={Layers} hue="sky" title="No categories yet" />} />
          </div>
        </Panel>

        <Panel
          title="Onboarding kits"
          subtitle="When HR hires somebody, the kit for their job title (or the one for everyone) becomes an approved request on the desk."
          icon={PackagePlus}
          hue="grape"
          actions={
            canAddKit ? (
              <Button size="sm" icon={Plus} onClick={() => setEditingKit("new")}>
                Add kit
              </Button>
            ) : undefined
          }
        >
          {kitError && <ErrorNote className="mb-4">{kitError}</ErrorNote>}
          {kits.length === 0 ? (
            <Empty icon={PackagePlus} hue="grape" title="No kits yet" hint="A kit lists what a new starter gets, like a laptop and a headset. Give it job titles, or none to make it everyone's." />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {kits.map((k) => (
                <li key={k.id}>
                  <Card as="div" className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-semibold text-neutral-900">{k.name}</p>
                      <div className="flex shrink-0 gap-1">
                        {canEditKit && (
                          <Button size="sm" variant="ghost" icon={PenLine} aria-label={`Edit the ${k.name} kit`} onClick={() => setEditingKit(k)} />
                        )}
                        {canDeleteKit && (
                          <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove the ${k.name} kit`} onClick={() => void removeKit(k)} />
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {k.jobTitleIds.length === 0 ? (
                        <Chip hue="mint">Everyone</Chip>
                      ) : (
                        k.jobTitleIds.map((id) => (
                          <Chip key={id} hue="blue">
                            {titleName.get(id) ?? "Job title"}
                          </Chip>
                        ))
                      )}
                    </div>
                    <ul className="mt-auto space-y-1.5 border-t border-neutral-100 pt-3 text-sm">
                      {k.items.map((i) => {
                        const c = catById.get(i.categoryId);
                        return (
                          <li key={i.categoryId} className="flex items-center justify-between gap-2">
                            <span className="truncate text-neutral-700">{c?.name ?? "A category no longer listed"}</span>
                            <span className="shrink-0 font-semibold tabular-nums text-neutral-900">× {i.quantity}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {editingCat && (
        <CategoryDialog
          category={editingCat === "new" ? undefined : editingCat}
          onClose={() => setEditingCat(null)}
          onDone={(c) => {
            setCategories((list) => {
              const rest = (list ?? []).filter((x) => x.id !== c.id);
              const prev = (list ?? []).find((x) => x.id === c.id);
              return [...rest, { ...c, assets: prev?.assets ?? 0 }].sort((a, b) => a.name.localeCompare(b.name));
            });
            setEditingCat(null);
          }}
        />
      )}
      {editingKit && (
        <KitDialog
          kit={editingKit === "new" ? undefined : editingKit}
          categories={categories}
          onClose={() => setEditingKit(null)}
          onDone={(k) => {
            setKits((list) => [...(list ?? []).filter((x) => x.id !== k.id), k].sort((a, b) => a.name.localeCompare(b.name)));
            setEditingKit(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryDialog({ category, onDone, onClose }: { category?: AssetCategory; onDone: (c: AssetCategory) => void; onClose: () => void }) {
  const uid = useId();
  const [code, setCode] = useState(category?.code ?? "");
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<"capital" | "controlled">(category?.kind ?? "capital");
  const [assetClass, setAssetClass] = useState<string>(category?.assetClass ?? "");
  const [active, setActive] = useState(category?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z]{2,6}$/.test(c)) {
      setErrors({ code: "A tag code is 2 to 6 letters, like LAP." });
      return;
    }
    if (!name.trim()) {
      setErrors({ name: "Name the category." });
      return;
    }
    setBusy(true);
    setErrors({});
    setError(null);
    const input = { code: c, name: name.trim(), kind, assetClass: kind === "capital" ? ((assetClass || null) as AssetClass | null) : null, active };
    try {
      onDone(category ? await assets.updateCategory(category.id, input) : await assets.createCategory(input));
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={category ? `Edit ${category.name}` : "Add a category"}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : category ? "Save changes" : "Add category"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field id={`${uid}-code`} label="Tag code">
          <input
            id={`${uid}-code`}
            className={`${inputClass} font-mono uppercase`}
            value={code}
            maxLength={6}
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAP"
            aria-invalid={errors.code ? true : undefined}
            aria-describedby={`${uid}-code-hint`}
          />
          <FieldError message={errors.code} />
        </Field>
        <Field id={`${uid}-name`} label="Name">
          <input id={`${uid}-name`} className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Laptops" aria-invalid={errors.name ? true : undefined} />
          <FieldError message={errors.name} />
        </Field>
      </div>
      <p id={`${uid}-code-hint`} className="-mt-3 text-xs text-neutral-500">
        Goes in every tag number in this category. It can&rsquo;t change once assets are tagged under it.
      </p>
      <Segmented
        label="Kind"
        value={kind}
        onChange={setKind}
        options={[
          { key: "capital", label: "Capital asset" },
          { key: "controlled", label: "Controlled item" },
        ]}
      />
      {kind === "capital" ? (
        <Field id={`${uid}-class`} label="Finance class" hint="Decides how Finance depreciates it">
          <SearchableSelect
            id={`${uid}-class`}
            value={assetClass}
            onChange={setAssetClass}
            clearable
            clearLabel="Not on Finance's books"
            placeholder="Not on Finance's books"
            searchPlaceholder="Search classes"
            options={Object.entries(ASSET_CLASS).map(([value, label]) => ({ value, label }))}
          />
          <FieldError message={errors.assetClass} />
        </Field>
      ) : (
        <p className="text-sm text-neutral-600">Controlled items (phones, headsets, tools) are tagged and tracked, but not booked or depreciated.</p>
      )}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-neutral-800">In use</p>
          <p className="text-xs text-neutral-500">Categories not in use are hidden from new requests.</p>
        </div>
        <Switch checked={active} onChange={setActive} label="In use" />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

function KitDialog({ kit, categories, onDone, onClose }: { kit?: AssetKit; categories: AssetCategory[]; onDone: (k: AssetKit) => void; onClose: () => void }) {
  const uid = useId();
  const titles = useSyncExternalStore(subscribeJobTitles, getJobTitlesState, getJobTitlesServerState);
  const [name, setName] = useState(kit?.name ?? "");
  const [jobTitleIds, setJobTitleIds] = useState<string[]>(kit?.jobTitleIds ?? []);
  const [items, setItems] = useState<KitItem[]>(kit?.items.length ? kit.items : [{ categoryId: "", quantity: 1 }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleName = new Map(titles.titles.map((t) => [t.id, t.name]));
  const catOptions = categories.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name, hint: c.code }));

  const setItem = (i: number, patch: Partial<KitItem>) => setItems((list) => list.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = items.filter((i) => i.categoryId);
    if (!name.trim()) {
      setErrors({ name: "Name the kit, e.g. Engineer starter kit." });
      return;
    }
    if (chosen.length === 0) {
      setErrors({ items: "Add at least one thing to the kit." });
      return;
    }
    if (new Set(chosen.map((i) => i.categoryId)).size !== chosen.length) {
      setErrors({ items: "List each category once, with a quantity." });
      return;
    }
    setBusy(true);
    setErrors({});
    setError(null);
    const input = { name: name.trim(), jobTitleIds, items: chosen.map((i) => ({ categoryId: i.categoryId, quantity: Math.max(1, Math.min(10, Math.round(i.quantity) || 1)) })) };
    try {
      onDone(kit ? await assets.updateKit(kit.id, input) : await assets.createKit(input));
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-title`}
      title={kit ? `Edit the ${kit.name} kit` : "Add an onboarding kit"}
      subtitle="What a new starter is given on their first day."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : kit ? "Save kit" : "Add kit"}
          </Button>
        </div>
      }
    >
      <Field id={`${uid}-name`} label="Kit name">
        <input id={`${uid}-name`} className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Engineer starter kit" aria-invalid={errors.name ? true : undefined} />
        <FieldError message={errors.name} />
      </Field>

      <Field id={`${uid}-titles`} label="For these job titles" hint="None means everyone">
        <JobTitlePicker
          id={`${uid}-titles`}
          mode="id"
          value=""
          allowCreate={false}
          placeholder="Add a job title"
          onChange={(v) => v && setJobTitleIds((list) => (list.includes(v) ? list : [...list, v]))}
        />
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Job titles on this kit">
          {jobTitleIds.length === 0 && <li className="text-xs text-neutral-500">Everyone without a kit of their own gets this one.</li>}
          {jobTitleIds.map((id) => (
            <li key={id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-primary-700">
                {titleName.get(id) ?? "Job title"}
                <button
                  type="button"
                  aria-label={`Take ${titleName.get(id) ?? "this job title"} off the kit`}
                  onClick={() => setJobTitleIds((list) => list.filter((x) => x !== id))}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-primary-100 focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">What is in it</legend>
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2">
              <SearchableSelect
                aria-label={`Category, item ${i + 1}`}
                className="min-w-0 flex-1"
                value={it.categoryId}
                onChange={(v) => setItem(i, { categoryId: v })}
                options={catOptions}
                placeholder="Choose a category"
                searchPlaceholder="Search categories"
              />
              <input
                type="number"
                min={1}
                max={10}
                aria-label={`Quantity, item ${i + 1}`}
                className={`${inputClass} w-20 text-right tabular-nums`}
                value={it.quantity}
                onChange={(e) => setItem(i, { quantity: Number(e.target.value) })}
              />
              <Button
                variant="ghost"
                icon={Trash2}
                aria-label={`Take item ${i + 1} off the kit`}
                disabled={items.length === 1}
                onClick={() => setItems((list) => list.filter((_, k) => k !== i))}
              />
            </li>
          ))}
        </ul>
        <Button size="sm" icon={Plus} className="mt-3" onClick={() => setItems((list) => [...list, { categoryId: "", quantity: 1 }])} disabled={items.length >= 20}>
          Add another item
        </Button>
        <FieldError message={errors.items ?? Object.entries(errors).find(([k]) => k.startsWith("items."))?.[1]} />
      </fieldset>
      <p className="text-xs text-neutral-500">{plural(items.filter((i) => i.categoryId).reduce((s, i) => s + (i.quantity || 0), 0), "item")} in this kit.</p>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
