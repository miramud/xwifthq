"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BookOpenCheck, Clock, FormInput, PenLine, Plus, Route, Trash2, UserRound } from "lucide-react";
import { Button, Chip, Empty, PageHeader, PriorityChip, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Field, Skeleton, Switch, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { desk, fieldKey, opsError, opsFieldErrors, type Catalogue, type CatalogueField, type CatalogueItem, type FieldType, type RoutesTo, type TicketPriority } from "@/lib/api/operations-desk-client";
import { ChipFilter, useOpsPickers } from "@/suite/operations/components/facilities/parts";
import { CategoryIcon } from "./parts";
import { PRIORITIES, ROUTES_FALLBACK } from "./labels";

const FIELD_TYPES: Record<FieldType, string> = { text: "Short answer", textarea: "Long answer", date: "Date", number: "Number", select: "Pick from a list" };

/**
 * What staff can ask the desk for. Each item names its category, who owns
 * it, its SLA, where it goes (a ticket, or straight to a work order,
 * requisition, asset request or vehicle booking), and the questions on its
 * form — built here, field by field.
 */
export default function CatalogueEditor() {
  const { user } = useAuth();
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<{ item?: CatalogueItem } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    desk.catalogue().then(
      (c) => {
        if (!alive) return;
        setCat(c);
        setError(null);
      },
      (e: unknown) => alive && setError(`The catalogue didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const shown = useMemo(() => (cat?.items ?? []).filter((i) => !category || i.category === category), [cat, category]);

  if (error && !cat) {
    return (
      <div>
        <BackLink href="/suite/operations/desk" label="Service desk" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!cat) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the catalogue…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const routes = { ...ROUTES_FALLBACK, ...cat.routes };
  const canCreate = mayDoOps(user, "service_desk", "create_item");
  const canEdit = mayDoOps(user, "service_desk", "update_item");

  return (
    <div>
      <BackLink href="/suite/operations/desk" label="Service desk" />
      <PageHeader
        title="Request catalogue"
        subtitle="What staff see under “Ask for help”: each request's form, owner, SLA and where it goes."
        actions={
          canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>
              Add a request
            </Button>
          )
        }
      />
      <Notice text={notice} />

      <div className="space-y-4">
        <ChipFilter
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { key: "", label: "Every category", count: cat.items.length },
            ...Object.entries(cat.categories)
              .filter(([k]) => cat.items.some((i) => i.category === k))
              .map(([k, label]) => ({ key: k, label, count: cat.items.filter((i) => i.category === k).length })),
          ]}
        />
        {shown.length === 0 ? (
          <div className="ws-card">
            <Empty icon={BookOpenCheck} title="Nothing in this category" hint="Add a request staff can make." />
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((i) => (
              <li key={i.id}>
                <article className={cx("ws-card flex h-full flex-col gap-4 p-5", !i.active && "opacity-70")}>
                  <div className="flex items-start gap-3">
                    <CategoryIcon category={i.category} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold text-neutral-900">{i.name}</h3>
                      <p className="text-xs text-neutral-500">{cat.categories[i.category] ?? i.category}</p>
                    </div>
                    {!i.active && <Chip>Hidden</Chip>}
                  </div>
                  {i.description && <p className="line-clamp-2 text-sm text-neutral-600">{i.description}</p>}
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-neutral-600">
                      <Route size={13} aria-hidden />
                      <dt className="sr-only">Goes to</dt>
                      <dd className="truncate">{routes[i.routesTo] ?? i.routesTo}</dd>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-600">
                      <Clock size={13} aria-hidden />
                      <dt className="sr-only">SLA</dt>
                      <dd>{i.slaHours}h SLA</dd>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-600">
                      <UserRound size={13} aria-hidden />
                      <dt className="sr-only">Owner</dt>
                      <dd className="truncate">{i.owner ?? "The desk"}</dd>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-600">
                      <FormInput size={13} aria-hidden />
                      <dt className="sr-only">Form</dt>
                      <dd>{i.fields.length ? `${i.fields.length} ${i.fields.length === 1 ? "question" : "questions"}` : "Title and description"}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                    <PriorityChip priority={i.defaultPriority} />
                    {canEdit && (
                      <Button size="sm" icon={PenLine} onClick={() => setEditing({ item: i })}>
                        Edit
                      </Button>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <ItemDialog
          item={editing.item}
          categories={cat.categories}
          routes={routes}
          onClose={() => setEditing(null)}
          onDone={() => {
            setNotice(editing.item ? "Request saved." : "Request added to the catalogue.");
            setEditing(null);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

interface DraftField extends CatalogueField {
  /** Local only: a stable React key. */
  uid: string;
  optionsText: string;
}

const draft = (uid: string, f?: CatalogueField): DraftField => ({
  key: f?.key ?? "",
  label: f?.label ?? "",
  type: f?.type ?? "text",
  required: f?.required ?? false,
  options: f?.options ?? [],
  optionsText: (f?.options ?? []).join("\n"),
  uid,
});

function ItemDialog({ item, categories, routes, onClose, onDone }: { item?: CatalogueItem; categories: Record<string, string>; routes: Record<string, string>; onClose: () => void; onDone: () => void }) {
  const uid = useId();
  const confirm = useConfirm();
  const { staff } = useOpsPickers();
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [routesTo, setRoutesTo] = useState<RoutesTo>(item?.routesTo ?? "ticket");
  const [ownerId, setOwnerId] = useState(item?.ownerId ?? "");
  const [slaHours, setSlaHours] = useState(String(item?.slaHours ?? 24));
  const [priority, setPriority] = useState<TicketPriority>(item?.defaultPriority ?? "normal");
  const [active, setActive] = useState(item?.active ?? true);
  const [fields, setFields] = useState<DraftField[]>(() => (item?.fields ?? []).map((f, i) => draft(`saved-${i}`, f)));
  const added = useRef(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (u: string, p: Partial<DraftField>) => setFields((list) => list.map((f) => (f.uid === u ? { ...f, ...p } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = async (f: DraftField) => {
    const ok = await confirm({ title: `Remove “${f.label || "this question"}”?`, body: "Answers already given to it stay on their tickets.", confirmLabel: "Remove the question" });
    if (ok) setFields((list) => list.filter((x) => x.uid !== f.uid));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name the request.";
    if (!category) next.category = "Choose a category.";
    const sla = Number(slaHours);
    if (!Number.isInteger(sla) || sla < 1 || sla > 720) next.slaHours = "1 to 720 hours.";
    const taken: string[] = [];
    const out: CatalogueField[] = [];
    fields.forEach((f, i) => {
      if (!f.label.trim()) next[`fields.${i}.label`] = "Write the question.";
      const options = f.optionsText
        .split(/\n|,/)
        .map((o) => o.trim())
        .filter(Boolean);
      if (f.type === "select" && options.length < 2) next[`fields.${i}.options`] = "Give at least two choices.";
      const key = f.key || fieldKey(f.label, taken);
      taken.push(key);
      out.push({ key, label: f.label.trim(), type: f.type, required: Boolean(f.required), ...(f.type === "select" ? { options } : {}) });
    });
    if (fields.length > 12) next.fields = "A form has at most 12 questions.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError(null);
    const input = { name: name.trim(), category, description: description.trim() || null, routesTo, ownerId: ownerId || null, slaHours: sla, defaultPriority: priority, fields: out, ...(item ? { active } : {}) };
    try {
      if (item) await desk.updateItem(item.id, input);
      else await desk.createItem(input);
      onDone();
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      size="lg"
      titleId={`${uid}-t`}
      title={item ? `Edit “${item.name}”` : "Add a request"}
      subtitle="Staff pick it under “Ask for help”, answer its questions, and the clock starts."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : item ? "Save changes" : "Add to the catalogue"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-n`} label="Name" className="sm:col-span-2">
          <input id={`${uid}-n`} className={inputClass} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="Projector for a meeting" aria-invalid={errors.name ? true : undefined} />
          <FieldError message={errors.name} />
        </Field>
        <Field id={`${uid}-c`} label="Category">
          <SearchableSelect
            id={`${uid}-c`}
            value={category}
            onChange={setCategory}
            options={Object.entries(categories).map(([value, label]) => ({ value, label }))}
            placeholder="Choose"
            aria-invalid={errors.category ? true : undefined}
          />
          <FieldError message={errors.category} />
        </Field>
        <Field id={`${uid}-r`} label="Goes to">
          <SearchableSelect id={`${uid}-r`} value={routesTo} onChange={(v) => setRoutesTo(v as RoutesTo)} options={Object.entries(routes).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field id={`${uid}-o`} label="Owner" hint="Gets it first">
          <SearchableSelect id={`${uid}-o`} value={ownerId} onChange={setOwnerId} options={staff ?? []} clearable clearLabel="The desk" placeholder="The desk" noOptionsText={staff ? "No staff" : "Loading staff…"} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${uid}-s`} label="SLA (hours)">
            <input id={`${uid}-s`} inputMode="numeric" className={inputClass} value={slaHours} onChange={(e) => setSlaHours(e.target.value)} aria-invalid={errors.slaHours ? true : undefined} />
            <FieldError message={errors.slaHours} />
          </Field>
          <Field id={`${uid}-p`} label="Priority">
            <SearchableSelect id={`${uid}-p`} value={priority} onChange={(v) => setPriority(v as TicketPriority)} options={Object.entries(PRIORITIES).map(([value, p]) => ({ value, label: p.label }))} />
          </Field>
        </div>
        <Field id={`${uid}-d`} label="What it's for" hint="Shown on the tile" className="sm:col-span-2">
          <textarea id={`${uid}-d`} rows={2} className={textareaClass} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="flex w-full items-center justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-900">The form</span>
          <span className="text-xs text-neutral-500">Every request asks for a title and a description; add the questions this one needs.</span>
        </legend>
        <FieldError message={errors.fields} />
        {fields.length === 0 && <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-5 text-center text-sm text-neutral-500">No extra questions.</p>}
        <ol className="space-y-3">
          {fields.map((f, i) => (
            <li key={f.uid} className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4">
              <div className="flex items-start gap-3">
                <span className={cx("mt-8 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold", "bg-white text-neutral-600 ring-1 ring-neutral-200")}>{i + 1}</span>
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                  <Field id={`${uid}-fl-${f.uid}`} label="Question">
                    <input
                      id={`${uid}-fl-${f.uid}`}
                      className={inputClass}
                      value={f.label}
                      maxLength={120}
                      onChange={(e) => patch(f.uid, { label: e.target.value })}
                      placeholder="Which room?"
                      aria-invalid={errors[`fields.${i}.label`] ? true : undefined}
                    />
                    <FieldError message={errors[`fields.${i}.label`]} />
                  </Field>
                  <Field id={`${uid}-ft-${f.uid}`} label="Answer">
                    <SearchableSelect id={`${uid}-ft-${f.uid}`} value={f.type} onChange={(v) => patch(f.uid, { type: v as FieldType })} options={Object.entries(FIELD_TYPES).map(([value, label]) => ({ value, label }))} />
                  </Field>
                  {f.type === "select" && (
                    <Field id={`${uid}-fo-${f.uid}`} label="Choices" hint="One per line" className="sm:col-span-2">
                      <textarea
                        id={`${uid}-fo-${f.uid}`}
                        rows={3}
                        className={textareaClass}
                        value={f.optionsText}
                        onChange={(e) => patch(f.uid, { optionsText: e.target.value })}
                        aria-invalid={errors[`fields.${i}.options`] ? true : undefined}
                      />
                      <FieldError message={errors[`fields.${i}.options`]} />
                    </Field>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <Switch checked={Boolean(f.required)} onChange={(v) => patch(f.uid, { required: v })} label={`${f.label || "Question"} must be answered`} />
                      Must be answered
                    </label>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" icon={ArrowUp} aria-label={`Move ${f.label || "question"} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                      <Button size="sm" variant="ghost" icon={ArrowDown} aria-label={`Move ${f.label || "question"} down`} disabled={i === fields.length - 1} onClick={() => move(i, 1)} />
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${f.label || "question"}`} className="text-error-700" onClick={() => void remove(f)} />
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <Button size="sm" icon={Plus} disabled={fields.length >= 12} onClick={() => {
            added.current += 1;
            const key = `new-${added.current}`;
            setFields((list) => [...list, draft(key)]);
          }} className="w-full border-dashed">
          Add a question
        </Button>
      </fieldset>

      {item && (
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3.5">
          <span>
            <span className="block text-sm font-semibold text-neutral-900">Staff can ask for it</span>
            <span className="block text-xs text-neutral-500">Hidden requests keep their tickets.</span>
          </span>
          <Switch checked={active} onChange={setActive} label="Staff can ask for it" />
        </label>
      )}
    </DialogFrame>
  );
}
