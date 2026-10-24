"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, BadgeCheck, FileStack, FolderKanban, HandCoins, Info, Landmark, Save, Send, UserRound, Wallet } from "lucide-react";
import { Button, Card, Chip, PageHeader, Panel, Segmented, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Field, FormActions, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError, PersonSelect } from "@/suite/org/components/foundations/shared";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import { useAuth } from "@/lib/auth-store";
import {
  spend,
  spendError,
  spendFieldErrors,
  type FundsPosition,
  type MemoFull,
  type MemoInput,
  type SpendDocument,
  type SpendOptions,
} from "@/lib/api/finance-spend-client";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount as money, amountInput, parseAmount } from "@/suite/finance/lib/format";
import { Money } from "@/suite/finance/components/banking/ui";
import { ChecklistDocuments } from "./ui";
import { MEMO_TYPES, requiredAt } from "./labels";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Raise a payment or an advance, or finish a draft: what it is for, how
 * much, which project or cost centre pays, who is paid, and the documents
 * its type needs. The project's available funds show as the amount is typed.
 * Bank details are never typed here: a vendor's come from the vendor
 * register, a colleague's from their staff record.
 */

type Kind = "payment" | "advance";
type Funding = "project" | "costCentre";
type PayeeKind = "vendor" | "staff";

interface Form {
  memoType: Kind;
  title: string;
  body: string;
  amount: string;
  funding: Funding;
  projectId: string;
  costCentreId: string;
  costCategory: string;
  payeeKind: PayeeKind;
  vendorId: string;
  staffId: string;
  neededBy: string;
}

const BLANK: Form = {
  memoType: "payment",
  title: "",
  body: "",
  amount: "",
  funding: "project",
  projectId: "",
  costCentreId: "",
  costCategory: "",
  payeeKind: "vendor",
  vendorId: "",
  staffId: "",
  neededBy: "",
};

function fromMemo(m: MemoFull): Form {
  return {
    memoType: m.type === "advance" ? "advance" : "payment",
    title: m.title ?? "",
    body: m.body ?? "",
    amount: amountInput(m.amount),
    funding: m.projectId || !m.costCentreId ? "project" : "costCentre",
    projectId: m.projectId ?? "",
    costCentreId: m.costCentreId ?? "",
    costCategory: m.costCategory ?? "",
    payeeKind: m.payee?.kind === "staff" ? "staff" : "vendor",
    vendorId: m.payee?.kind === "vendor" ? m.payee.id : "",
    staffId: m.payee?.kind === "staff" ? m.payee.id : "",
    neededBy: m.neededBy ?? "",
  };
}

/** Which form section an API field error belongs to. */
const FIELD_OF: Record<string, keyof Errors> = {
  title: "title",
  body: "body",
  amount: "amount",
  project: "funding",
  projectId: "funding",
  costCentreId: "funding",
  funds: "funding",
  costCategory: "costCategory",
  payee: "payee",
  payeeUserId: "payee",
  payeeCounterpartyId: "payee",
  neededBy: "neededBy",
  documents: "documents",
  memoType: "memoType",
};

interface Errors {
  title?: string;
  body?: string;
  amount?: string;
  funding?: string;
  costCategory?: string;
  payee?: string;
  neededBy?: string;
  documents?: string;
  memoType?: string;
  general?: string;
}

function toErrors(e: unknown): Errors {
  const fields = spendFieldErrors(e);
  const out: Errors = {};
  for (const [k, v] of Object.entries(fields)) {
    const slot = FIELD_OF[k] ?? FIELD_OF[k.split(".")[0]];
    if (slot) out[slot] = out[slot] ?? v;
    else out.general = out.general ?? v;
  }
  if (Object.keys(out).length === 0) out.general = spendError(e);
  return out;
}

export default function RequestEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");
  const { user } = useAuth();
  const confirm = useConfirm();
  const mayOverride = mayDo(user, "memos", "override");

  const [options, setOptions] = useState<SpendOptions | null>(null);
  const [memo, setMemo] = useState<MemoFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState<Form>(BLANK);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [funds, setFunds] = useState<{ projectId: string; state: "loading" | "ready" | "error"; data?: FundsPosition } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [vendors, setVendors] = useState<SelectOption[] | null>(null);
  const [costCentres, setCostCentres] = useState<SelectOption[] | null>(null);

  /* The draft this form itself just created: its new address needs no reload. */
  const created = useRef<string | null>(null);

  /* What the form offers, and the draft being finished. */
  useEffect(() => {
    if (editId && created.current === editId) return;
    let alive = true;
    Promise.all([spend.me.options(), editId ? spend.me.get(editId) : Promise.resolve(null)])
      .then(([o, m]) => {
        if (!alive) return;
        if (m && m.status !== "draft") {
          // Sent already: its page is the place to follow it.
          router.replace(`/suite/finance/requests/${m.id}`);
          return;
        }
        setOptions(o);
        setMemo(m);
        if (m) setForm(fromMemo(m));
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(`The request form didn't load. ${spendError(e)}`));
    return () => {
      alive = false;
    };
  }, [editId, reload, router]);

  useEffect(() => {
    let alive = true;
    orgFoundations.lookups
      .counterparties({ role: "vendor" })
      .then((rows) => alive && setVendors(rows.map((c) => ({ value: c.id, label: c.name, hint: c.code ?? undefined }))))
      .catch(() => alive && setVendors([]));
    orgFoundations.lookups
      .costCentres()
      .then((rows) => alive && setCostCentres(rows.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))))
      .catch(() => alive && setCostCentres([]));
    return () => {
      alive = false;
    };
  }, []);

  /* The chosen project's funds, live. */
  const projectId = form.funding === "project" ? form.projectId : "";
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    spend.me.funds(projectId).then(
      (data) => alive && setFunds({ projectId, state: "ready", data }),
      () => alive && setFunds({ projectId, state: "error" }),
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(null);
  };

  const minor = parseAmount(form.amount);
  const position = funds && funds.projectId === projectId && funds.state === "ready" ? funds.data! : null;
  const overFunds = position !== null && position.controlled && (!position.hasRelease || (minor ?? 0) > position.available);

  const checklist = useMemo(() => {
    const defs = options?.checklists[form.memoType] ?? [];
    return defs.map((d) => ({
      code: d.code,
      label: d.label,
      hint: d.hint,
      required: requiredAt(d, minor),
      requiredNote: d.required && d.requiredFrom != null ? (requiredAt(d, minor) ? `Required because the amount is ${money(d.requiredFrom)} or more.` : `Required from ${money(d.requiredFrom)}.`) : undefined,
    }));
  }, [options, form.memoType, minor]);
  const documents: SpendDocument[] = memo?.documents ?? [];
  const missing = checklist.filter((i) => i.required && !documents.some((d) => d.itemCode === i.code));

  const projectOptions: SelectOption[] = useMemo(() => (options?.projects ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined })), [options]);
  const categoryOptions: SelectOption[] = useMemo(() => Object.entries(options?.categories ?? {}).map(([value, label]) => ({ value, label })), [options]);

  /** The form as the API takes it. */
  const input = useCallback((): MemoInput | null => {
    const local: Errors = {};
    if (!form.title.trim()) local.title = "Give the request a short title.";
    if (!form.body.trim()) local.body = "Say what the money is for and why it is needed.";
    if (minor === null || minor <= 0) local.amount = form.amount.trim() ? "Type the amount as a number, like 250,000.00." : "Say how much is needed.";
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return null;
    }
    const advance = form.memoType === "advance";
    return {
      ...(memo ? {} : { memoType: form.memoType }),
      title: form.title.trim(),
      body: form.body.trim(),
      amount: minor!,
      projectId: form.funding === "project" ? form.projectId || null : null,
      costCentreId: form.funding === "costCentre" ? form.costCentreId || null : null,
      costCategory: form.costCategory || null,
      payeeCounterpartyId: !advance && form.payeeKind === "vendor" ? form.vendorId || null : null,
      payeeUserId: !advance && form.payeeKind === "staff" ? form.staffId || null : null,
      neededBy: form.neededBy || null,
    };
  }, [form, minor, memo]);

  /** Save the draft; the first save gives it an address so a reload keeps it. */
  const save = useCallback(async (): Promise<MemoFull | null> => {
    const body = input();
    if (!body) return null;
    setErrors({});
    try {
      const m = memo ? await spend.me.update(memo.id, body) : await spend.me.create(body);
      setMemo(m);
      if (!memo) {
        created.current = m.id;
        router.replace(`/suite/finance/requests/new?id=${m.id}`);
      }
      return m;
    } catch (e) {
      setErrors(toErrors(e));
      return null;
    }
  }, [input, memo, router]);

  const onSave = async () => {
    setBusy("save");
    const m = await save();
    setBusy(null);
    if (m) setSaved("Draft saved. Attach the documents and send it when it is ready.");
  };

  const onSend = async () => {
    setBusy("send");
    const m = await save();
    if (!m) {
      setBusy(null);
      return;
    }
    try {
      await spend.me.submit(m.id, overFunds && mayOverride && overrideReason.trim() ? overrideReason.trim() : null);
      router.push(`/suite/finance/requests/${m.id}`);
    } catch (e) {
      const errs = toErrors(e);
      // Said again beside the button, so nobody has to hunt for why it didn't go.
      if (!errs.general && !(errs.funding && overFunds && !mayOverride)) {
        const first = Object.values(errs).find(Boolean);
        if (first) errs.general = `It wasn't sent. ${first}`;
      }
      setErrors(errs);
      setBusy(null);
    }
  };

  const onUpload = async (code: string, file: File) => {
    setUploading(code);
    setDocErrors({});
    try {
      // A document hangs on a saved request: save the draft first if needed.
      const m = memo ?? (await save());
      if (!m) {
        setDocErrors({ [code]: "Fill in the title, what it is for and the amount first; the draft is saved before the document is attached." });
        return;
      }
      const docs = await spend.me.upload(m.id, file, code);
      setMemo((cur) => (cur ? { ...cur, documents: docs } : { ...m, documents: docs }));
      setErrors((e) => ({ ...e, documents: undefined }));
    } catch (e) {
      setDocErrors({ [code]: spendError(e) });
    } finally {
      setUploading(null);
    }
  };

  const onRemove = async (d: SpendDocument) => {
    if (!memo) return;
    const ok = await confirm({ title: `Remove ${d.fileName}?`, body: "The file is taken off this draft and deleted.", confirmLabel: "Remove" });
    if (!ok) return;
    try {
      await spend.me.deleteDocument(d.id);
      setMemo({ ...memo, documents: memo.documents.filter((x) => x.id !== d.id) });
    } catch (e) {
      setDocErrors({ [d.itemCode ?? "_"]: spendError(e) });
    }
  };

  if (loadError) {
    return (
      <div>
        <BackLink href="/suite/finance/requests" label="My requests" />
        <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />
      </div>
    );
  }

  if (!options) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the request form…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const advance = form.memoType === "advance";
  const firstMissing = missing[0];

  return (
    <div>
      <BackLink href="/suite/finance/requests" label="My requests" />
      <PageHeader
        eyebrow={memo?.reference ?? (memo ? "Draft" : "New request")}
        title={memo ? form.title || "Untitled request" : "Ask for a payment or an advance"}
        subtitle="Fill it in, attach what its type needs, and send it. Finance takes it from there."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          {/* What kind of request */}
          <Panel title="What kind of request" icon={HandCoins}>
            <fieldset>
              <legend className="sr-only">Request type</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["payment", "advance"] as Kind[]).map((k) => {
                  const on = form.memoType === k;
                  const locked = Boolean(memo) && !on;
                  return (
                    <label
                      key={k}
                      className={cx(
                        "relative flex cursor-pointer gap-3 rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-primary-300",
                        on ? "border-primary-500 bg-primary-50/60" : "border-neutral-200 bg-white hover:border-neutral-300",
                        locked && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <input type="radio" name="memoType" value={k} checked={on} disabled={locked} onChange={() => set("memoType", k)} className="sr-only" />
                      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", on ? "bg-primary-600 text-white" : HUE.slate.soft)}>
                        {k === "payment" ? <Landmark size={18} aria-hidden /> : <Wallet size={18} aria-hidden />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-neutral-900">{options.types[k] ?? MEMO_TYPES[k].label}</span>
                        <span className="mt-0.5 block text-xs text-neutral-500">{MEMO_TYPES[k].hint}</span>
                      </span>
                      {on && <BadgeCheck size={18} className="absolute right-3 top-3 text-primary-600" aria-hidden />}
                    </label>
                  );
                })}
              </div>
              {memo && <p className="mt-2 text-xs text-neutral-500">A request keeps its type once saved. To change it, delete this draft and raise a new one.</p>}
              <FieldError message={errors.memoType} />
            </fieldset>
          </Panel>

          {/* What it is for */}
          <Panel title="What it is for" icon={FileStack} hue="grape">
            <div className="space-y-4">
              <Field id="req-title" label="Title" hint="Required">
                <input
                  id="req-title"
                  className={inputClass}
                  value={form.title}
                  maxLength={255}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder={advance ? "Travel advance: Abuja site visit" : "Swiftlink: September fibre lease"}
                  aria-invalid={errors.title ? true : undefined}
                  aria-describedby={errors.title ? "req-title-err" : undefined}
                />
                <FieldError id="req-title-err" message={errors.title} />
              </Field>
              <Field id="req-body" label="Justification" hint="Required">
                <RichTextEditor
                  id="req-body"
                  variant="full"
                  minHeight={220}
                  value={form.body}
                  onChange={(html) => set("body", html)}
                  placeholder="What the money is for, why it is needed now, and anything the approvers should know."
                  invalid={Boolean(errors.body)}
                  describedBy={errors.body ? "req-body-err" : undefined}
                />
                <FieldError id="req-body-err" message={errors.body} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="req-amount" label="Amount (₦)" hint="Required">
                  <input
                    id="req-amount"
                    inputMode="decimal"
                    className={cx(inputClass, "tabular-nums")}
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    onBlur={() => minor !== null && set("amount", amountInput(minor))}
                    placeholder="0.00"
                    aria-invalid={errors.amount ? true : undefined}
                    aria-describedby="req-amount-hint req-amount-err"
                  />
                  <p id="req-amount-hint" className="mt-1.5 text-xs text-neutral-500">
                    {minor !== null && minor > 0 ? money(minor) : "In naira and kobo, like 250,000.00."}
                  </p>
                  <FieldError id="req-amount-err" message={errors.amount} />
                </Field>
                <Field id="req-needed" label="Needed by" hint="Optional">
                  <input id="req-needed" type="date" className={inputClass} value={form.neededBy} onChange={(e) => set("neededBy", e.target.value)} />
                  <FieldError message={errors.neededBy} />
                </Field>
              </div>
              <Field id="req-category" label="Cost category" hint="Optional">
                <SearchableSelect
                  id="req-category"
                  value={form.costCategory}
                  onChange={(v) => set("costCategory", v)}
                  options={categoryOptions}
                  clearable
                  placeholder="Choose what kind of cost it is"
                  searchPlaceholder="Search categories"
                />
                <FieldError message={errors.costCategory} />
              </Field>
            </div>
          </Panel>

          {/* Who pays for it */}
          <Panel
            title="Which budget pays"
            subtitle="Every payment is charged to a project or a cost centre"
            icon={FolderKanban}
            hue="sky"
          >
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
              <div className="space-y-4">
                <Field id="req-project" label="Project">
                  <SearchableSelect
                    id="req-project"
                    value={form.projectId}
                    onChange={(v) => set("projectId", v)}
                    options={projectOptions}
                    clearable
                    placeholder="Choose the project"
                    searchPlaceholder="Search projects"
                    noOptionsText="No projects in this organisation."
                    aria-invalid={errors.funding ? true : undefined}
                  />
                </Field>
                {projectId && <FundsLive funds={funds && funds.projectId === projectId ? funds : null} position={position} requested={minor} />}
                {overFunds && mayOverride && (
                  <Field id="req-override" label="Your reason for going beyond the funds" hint="Only you, as an MD or delegate, can">
                    <textarea
                      id="req-override"
                      rows={2}
                      className={textareaClass}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Why this should be paid before more funds are released"
                    />
                  </Field>
                )}
              </div>
            ) : (
              <Field id="req-cc" label="Cost centre">
                <SearchableSelect
                  id="req-cc"
                  value={form.costCentreId}
                  onChange={(v) => set("costCentreId", v)}
                  options={costCentres ?? []}
                  clearable
                  placeholder={costCentres === null ? "Loading cost centres…" : "Choose the cost centre"}
                  searchPlaceholder="Search cost centres"
                  noOptionsText={costCentres === null ? "Loading cost centres…" : "No cost centres yet."}
                  aria-invalid={errors.funding ? true : undefined}
                />
              </Field>
            )}
            <FieldError message={errors.funding} />
          </Panel>

          {/* Who is paid */}
          <Panel
            title="Who is paid"
            icon={UserRound}
            hue="mint"
          >
            {!advance && (
              <div className="mb-4">
                <Segmented
                  label="Payee"
                  value={form.payeeKind}
                  onChange={(v) => set("payeeKind", v)}
                  options={[
                    { key: "vendor", label: "Vendor" },
                    { key: "staff", label: "Member of staff" },
                  ]}
                />
              </div>
            )}
            {advance ? (
              <p className="flex items-start gap-2 text-sm text-neutral-700">
                <Info size={16} className="mt-0.5 shrink-0 text-sky-600" aria-hidden />
                An advance is paid to you, into the bank account on your staff record. You account for it with receipts afterwards.
              </p>
            ) : form.payeeKind === "vendor" ? (
              <Field id="req-vendor" label="Vendor">
                <SearchableSelect
                  id="req-vendor"
                  value={form.vendorId}
                  onChange={(v) => set("vendorId", v)}
                  options={vendors ?? []}
                  clearable
                  placeholder={vendors === null ? "Loading vendors…" : "Choose from the vendor register"}
                  searchPlaceholder="Search vendors"
                  noOptionsText={vendors === null ? "Loading vendors…" : "No vendors in the register yet. Ask Finance to add one."}
                  aria-invalid={errors.payee ? true : undefined}
                />
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-neutral-500">
                  <Landmark size={13} className="mt-0.5 shrink-0" aria-hidden />
                  The vendor&apos;s approved bank details come from the vendor register. You never type bank details here.
                </p>
              </Field>
            ) : (
              <Field id="req-staff" label="Member of staff">
                <PersonSelect id="req-staff" value={form.staffId} onChange={(v) => set("staffId", v)} clearable placeholder="Choose a colleague" invalid={Boolean(errors.payee)} />
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-neutral-500">
                  <Landmark size={13} className="mt-0.5 shrink-0" aria-hidden />
                  Paid into the bank account on their staff record.
                </p>
              </Field>
            )}
            <FieldError message={errors.payee} />
          </Panel>

          {/* Documents */}
          <Panel
            title="Documents"
            subtitle={
              missing.length === 0
                ? "Everything required is attached."
                : `${missing.length} required ${missing.length === 1 ? "document is" : "documents are"} still to attach.`
            }
            icon={FileStack}
            hue={missing.length === 0 ? "mint" : "sun"}
          >
            {!memo && <p className="mb-3 text-xs text-neutral-500">Attaching the first document saves this request as a draft.</p>}
            {errors.documents && <ErrorNote className="mb-3">{errors.documents}</ErrorNote>}
            <ChecklistDocuments items={checklist} documents={documents} onUpload={(c, f) => void onUpload(c, f)} onRemove={(d) => void onRemove(d)} busyCode={uploading} errors={docErrors} />
          </Panel>
        </div>

        {/* Summary */}
        <aside className="min-w-0 space-y-5" aria-label="Summary">
          <Card className="p-5 xl:sticky xl:top-20">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{advance ? "Advance to you" : "To be paid"}</p>
            <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">{minor ? money(minor) : "₦0.00"}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <SummaryRow ok={Boolean(form.title.trim() && form.body.trim())} text="Title and justification" />
              <SummaryRow ok={Boolean(minor && minor > 0)} text="Amount" />
              <SummaryRow ok={Boolean(form.funding === "project" ? form.projectId : form.costCentreId)} text={form.funding === "project" ? "Project" : "Cost centre"} warn={overFunds ? "Beyond the funds available" : undefined} />
              {!advance && <SummaryRow ok={Boolean(form.payeeKind === "vendor" ? form.vendorId : form.staffId)} text="Who is paid" />}
              <SummaryRow ok={missing.length === 0} text={missing.length === 0 ? "Required documents" : `Required documents (${checklist.filter((i) => i.required).length - missing.length} of ${checklist.filter((i) => i.required).length})`} />
            </ul>
            {firstMissing && <p className="mt-3 text-xs text-neutral-500">Next: attach {firstMissing.label.toLowerCase()}.</p>}
          </Card>
        </aside>
      </div>

      <div className="mt-6">
        {errors.general && <ErrorNote className="mb-3">{errors.general}</ErrorNote>}
        {errors.funding && !errors.general && overFunds && !mayOverride && (
          <ErrorNote className="mb-3">{errors.funding} Only the MD can let a request go beyond the funds released; ask Finance.</ErrorNote>
        )}
        {saved && (
          <p role="status" className="mb-3 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">
            {saved}
          </p>
        )}
        <FormActions note={overFunds ? (mayOverride ? "Beyond the funds: give your reason above to send it anyway." : "This asks for more than the project has available. It can be saved, but sending is refused until funds are released.") : "Approvers see the funds position at the moment you send it."}>
          <Button icon={Save} onClick={() => void onSave()} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </Button>
          <Button variant="primary" icon={Send} onClick={() => void onSend()} disabled={busy !== null}>
            {busy === "send" ? "Sending…" : "Send to Finance"}
          </Button>
        </FormActions>
      </div>
    </div>
  );
}

function SummaryRow({ ok, text, warn }: { ok: boolean; text: string; warn?: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", warn ? "bg-sun-100 text-sun-700" : ok ? "bg-mint-500 text-white" : "border border-dashed border-neutral-300")}>
        {warn ? <AlertTriangle size={11} aria-hidden /> : ok ? <BadgeCheck size={12} aria-hidden /> : null}
      </span>
      <span className={ok ? "text-neutral-800" : "text-neutral-500"}>
        {text}
        <span className="sr-only">{warn ? `: ${warn}` : ok ? ": done" : ": not yet"}</span>
        {warn && <span className="block text-xs text-sun-700">{warn}</span>}
      </span>
    </li>
  );
}

/** The chosen project's money: available now, this request, and what it would leave. */
function FundsLive({
  funds,
  position,
  requested,
}: {
  funds: { state: "loading" | "ready" | "error" } | null;
  position: FundsPosition | null;
  requested: number | null;
}) {
  if (!funds || funds.state === "loading") {
    return (
      <p role="status" className="text-sm text-neutral-500">
        Checking the project&apos;s funds…
      </p>
    );
  }
  if (funds.state === "error" || !position) return <p className="text-sm text-neutral-500">The project&apos;s funds couldn&apos;t be checked. They are checked again when you send it.</p>;
  if (!position.controlled) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">
        <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
        Project funds aren&apos;t being controlled yet, so any amount can be sent.
      </p>
    );
  }
  if (!position.hasRelease) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-xl bg-sun-50 px-3 py-2.5 text-sm text-sun-700 ring-1 ring-sun-500/30">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          {position.hasBudget ? "No funds have been released to this project yet." : "This project has no approved budget or released funds yet."} The request can be saved, but it can&apos;t be sent until the MD releases funds.
        </span>
      </div>
    );
  }
  const req = requested ?? 0;
  const left = position.available - req;
  const over = left < 0;
  const pct = position.available > 0 ? Math.min(100, (req / position.available) * 100) : 100;
  return (
    <div className={cx("rounded-2xl border p-4", over ? "border-rose-500/30 bg-rose-50/40" : "border-neutral-200/80 bg-neutral-50/40")} aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-neutral-600">Available on this project</span>
        <Money value={position.available} className="font-bold text-neutral-900" />
      </div>
      <div className="ws-hatch mt-3 h-2.5 overflow-hidden rounded-full" aria-hidden>
        <div className={cx("h-full rounded-full", over ? "bg-rose-500" : "bg-primary-500")} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-neutral-500">This request {money(req)}</span>
        {over ? (
          <Chip hue="rose" icon={AlertTriangle}>
            {money(-left)} more than is available
          </Chip>
        ) : (
          <span className="font-semibold text-neutral-700">{money(left)} left after it</span>
        )}
      </div>
      {over && <p className="mt-2 text-xs text-rose-700">Ask for an additional release, or the MD can let it go beyond the funds with a reason.</p>}
    </div>
  );
}

