"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Banknote, Check, CircleX, Clock, Landmark, Plus, Save, Tags, Trash2, UserCheck, X } from "lucide-react";
import { orgFoundations, type BankAccount, type Counterparty, type CounterpartyInput, type CounterpartyRole } from "@/lib/api/org-foundations-client";
import { Button, ButtonLink, CalloutStrip, Chip, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { useAuth } from "@/lib/auth-store";
import { BackLink, ErrorNote, FaceAvatar, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { SHORT_CODE, SHORT_CODE_ERROR, SHORT_CODE_HINT, bankStage, bankTimeline, dateLabel, goesThroughApprovals, mayCheck } from "./logic";
import { CurrencySelect, FieldError, LoadError, Notice, errorText, fieldErrors } from "./shared";
import { KycChip, RolePicker, STATUS } from "./CounterpartiesBoard";
import ContactsPanel from "./CounterpartyContacts";

/**
 * One client or vendor: identity and tax details, the roles it plays, the
 * other names it goes by (used to match bank statement lines), and its bank
 * accounts. Bank details follow maker-checker: whoever enters them can't
 * approve them, and while the organisation runs bank changes through the
 * approval engine they are decided from Approvals.
 */

const FIELDS = [
  "name",
  "shortCode",
  "legalName",
  "kind",
  "sector",
  "website",
  "email",
  "phone",
  "address",
  "country",
  "tin",
  "rcNumber",
  "vatNumber",
  "defaultCurrency",
  "paymentTermsDays",
  "notes",
  "status",
  "kycStatus",
] as const;

/** The identity form: every field as the text somebody types. */
export type Form = Record<(typeof FIELDS)[number], string>;

function toForm(c: Counterparty): Form {
  const out = {} as Form;
  for (const k of FIELDS) {
    const v = (c as unknown as Record<string, unknown>)[k];
    (out as Record<string, string>)[k] = v == null ? "" : String(v);
  }
  return out;
}

/** Only what changed, with blanks as null and the number as a number. */
export function counterpartyPatch(before: Form, after: Form): CounterpartyInput {
  const out: Record<string, unknown> = {};
  for (const k of FIELDS) {
    if (before[k] === after[k]) continue;
    const v = after[k].trim();
    if (k === "paymentTermsDays") out[k] = v === "" ? null : Number(v);
    else if (k === "country" || k === "defaultCurrency" || k === "shortCode") out[k] = v === "" ? null : v.toUpperCase();
    else if (k === "name" || k === "kind" || k === "status" || k === "kycStatus") out[k] = v;
    else out[k] = v === "" ? null : v;
  }
  return out as CounterpartyInput;
}

export default function CounterpartyDetail({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [cp, setCp] = useState<Counterparty | null>(null);
  const [original, setOriginal] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let alive = true;
    orgFoundations.counterparties
      .get(id)
      .then((c) => {
        if (!alive) return;
        setCp(c);
        setOriginal(toForm(c));
        setForm(toForm(c));
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e, "This client or vendor didn't load.")));
    return () => {
      alive = false;
    };
  }, [id, reload]);

  /** A fresh record from the API: keep any unsaved edits to the identity form. */
  const take = (c: Counterparty, text: string) => {
    setCp(c);
    setError(null);
    setNotice(text);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !original || !cp) return;
    const found: Record<string, string> = {};
    if (form.name.trim() === "") found.name = "Give them a name.";
    if (form.shortCode.trim() && !SHORT_CODE.test(form.shortCode.trim())) found.shortCode = SHORT_CODE_ERROR;
    if (form.country.trim() && !/^[A-Za-z]{2}$/.test(form.country.trim())) found.country = "Use the two-letter country code, like NG.";
    if (form.paymentTermsDays.trim() && !/^\d{1,3}$/.test(form.paymentTermsDays.trim())) found.paymentTermsDays = "Use a number of days from 0 to 365.";
    setErrors(found);
    setError(null);
    setNotice(null);
    if (Object.keys(found).length > 0) return;
    const patch = counterpartyPatch(original, form);
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    try {
      const saved = await orgFoundations.counterparties.update(cp.id, patch);
      setCp(saved);
      setOriginal(toForm(saved));
      setForm(toForm(saved));
      setNotice("Changes saved.");
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err, "The changes weren't saved."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!cp) return;
    const ok = await confirm({
      title: `Delete ${cp.name}?`,
      body: "They go to the recycle bin. Anyone still used by a project, purchase or invoice can't be deleted; mark them former instead.",
      confirmLabel: "Delete",
      recoverable: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await orgFoundations.counterparties.remove(cp.id);
      router.push("/suite/org/counterparties");
    } catch (err) {
      // 422: "Still used by N projects…"
      setNotice(null);
      setError(errorText(err, `${cp.name} wasn't deleted.`));
    }
  };

  if (loadError) {
    return (
      <div>
        <BackLink href="/suite/org/counterparties" label="Clients and vendors" />
        <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />
      </div>
    );
  }

  if (!cp || !form) {
    return (
      <div aria-busy="true">
        <p className="sr-only">Loading…</p>
        <Skeleton className="mb-6 h-16 w-1/2" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[520px] lg:col-span-2" />
          <Skeleton className="h-[320px]" />
        </div>
      </div>
    );
  }

  const dirty = original ? Object.keys(counterpartyPatch(original, form)).length > 0 : false;
  const set = (k: keyof Form, v: string) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setErrors((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  };

  return (
    <div>
      <BackLink href="/suite/org/counterparties" label="Clients and vendors" />
      <PageHeader
        title={
          cp.shortCode ? (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{cp.name}</span>
              <span
                title="Short code, printed in reference numbers"
                className="inline-flex h-7 items-center rounded-lg border border-primary-200 bg-primary-50 px-2 font-mono text-sm font-semibold tracking-normal text-primary-700"
              >
                <span className="sr-only">Short code </span>
                {cp.shortCode}
              </span>
            </span>
          ) : (
            cp.name
          )
        }
        subtitle={[cp.code, cp.legalName && cp.legalName !== cp.name ? cp.legalName : null].filter(Boolean).join(" · ") || undefined}
        actions={
          <Button icon={Trash2} onClick={() => void remove()} className="text-error-700 hover:text-error-700">
            Delete
          </Button>
        }
      />
      <div className="-mt-3 mb-6 flex flex-wrap gap-2">
        <Chip hue={STATUS[cp.status].hue} dot>
          {STATUS[cp.status].label}
        </Chip>
        <KycChip status={cp.kycStatus} />
      </div>

      <Notice text={notice} />
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <form onSubmit={save} noValidate aria-label="Identity and tax">
            <IdentityPanel form={form} set={set} errors={errors} dirty={dirty} saving={saving} onDiscard={() => original && (setForm(original), setErrors({}))} />
          </form>

          <ContactsPanel cp={cp} onSaved={take} />

          <Panel
            title="Bank accounts"
            subtitle="Entered by one person, approved by another. Numbers are masked."
            icon={Banknote}
            hue="mint"
            actions={
              <Button size="sm" icon={Plus} onClick={() => setRequesting(true)}>
                Add bank account
              </Button>
            }
          >
            {cp.bankAccounts.length === 0 ? (
              <CalloutStrip icon={Banknote} hue="sun" title="No bank accounts yet">
                Payments can&apos;t go out until one is added and approved.
              </CalloutStrip>
            ) : (
              <ul className="space-y-3">
                {cp.bankAccounts.map((a) => (
                  <BankAccountCard key={a.id} cp={cp} account={a} userId={user?.id ?? null} onChanged={take} />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <RolesPanel cp={cp} onSaved={take} />
          <AliasesPanel cp={cp} onSaved={take} />
        </div>
      </div>

      {requesting && (
        <RequestAccountDialog
          cp={cp}
          onClose={() => setRequesting(false)}
          onSaved={(c) => {
            setRequesting(false);
            take(c, "Bank account added. It waits for a second person to approve it.");
          }}
        />
      )}
    </div>
  );
}

/* --------------------------- identity panel ------------------------- */

function IdentityPanel({
  form,
  set,
  errors,
  dirty,
  saving,
  onDiscard,
}: {
  form: Form;
  set: (k: keyof Form, v: string) => void;
  errors: Record<string, string>;
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
}) {
  const uid = useId();
  const lbl = "mb-1.5 block text-sm font-medium text-neutral-700";
  const text = (k: keyof Form, label: string, opts: { max?: number; type?: string; span?: boolean; upper?: boolean; placeholder?: string; hint?: string; mono?: boolean } = {}) => (
    <div className={opts.span ? "sm:col-span-2" : undefined}>
      <label htmlFor={`${uid}-${k}`} className={lbl}>
        {label}
      </label>
      <input
        id={`${uid}-${k}`}
        type={opts.type ?? "text"}
        value={form[k]}
        maxLength={opts.max}
        placeholder={opts.placeholder}
        onChange={(e) => set(k, opts.upper ? e.target.value.toUpperCase() : e.target.value)}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={opts.hint ? `${uid}-${k}-hint` : undefined}
        spellCheck={opts.mono ? false : undefined}
        autoComplete={opts.mono ? "off" : undefined}
        className={cx(inputClass, opts.mono && "font-mono")}
      />
      <FieldError message={errors[k]} />
      {opts.hint && (
        <p id={`${uid}-${k}-hint`} className="mt-1.5 text-xs text-neutral-500">
          {opts.hint}
        </p>
      )}
    </div>
  );

  return (
    <Panel
      title="Identity and tax"
      icon={Landmark}
      actions={
        <>
          {dirty && (
            <Button size="sm" variant="ghost" onClick={onDiscard} disabled={saving}>
              Discard
            </Button>
          )}
          <Button size="sm" type="submit" variant="primary" icon={Save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", "Name", { max: 255 })}
        {text("legalName", "Legal name", { max: 255 })}
        {text("shortCode", "Short code", { max: 12, upper: true, mono: true, placeholder: "EMMS", hint: SHORT_CODE_HINT })}
        <div>
          <label htmlFor={`${uid}-kind`} className={lbl}>
            Kind
          </label>
          <SearchableSelect
            id={`${uid}-kind`}
            value={form.kind}
            onChange={(v) => set("kind", v)}
            options={[
              { value: "organisation", label: "Organisation" },
              { value: "individual", label: "Individual" },
              { value: "government", label: "Government body" },
            ]}
          />
        </div>
        {text("sector", "Sector", { max: 96 })}
        {text("email", "Email", { max: 255, type: "email" })}
        {text("phone", "Phone", { max: 32, type: "tel" })}
        {text("website", "Website", { max: 255, type: "url", placeholder: "https://" })}
        {text("country", "Country code", { max: 2, upper: true, placeholder: "NG" })}
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-address`} className={lbl}>
            Address
          </label>
          <textarea id={`${uid}-address`} rows={2} maxLength={1000} value={form.address} onChange={(e) => set("address", e.target.value)} className={textareaClass} />
        </div>
        {text("tin", "Tax ID (TIN)", { max: 32 })}
        {text("rcNumber", "RC number", { max: 32 })}
        {text("vatNumber", "VAT number", { max: 32 })}
        <div>
          <label htmlFor={`${uid}-cur`} className={lbl}>
            Default currency
          </label>
          <CurrencySelect id={`${uid}-cur`} value={form.defaultCurrency} onChange={(v) => set("defaultCurrency", v)} clearable placeholder="Same as ours" />
        </div>
        {text("paymentTermsDays", "Payment terms (days)", { max: 3, type: "number" })}
        <div>
          <label htmlFor={`${uid}-status`} className={lbl}>
            Status
          </label>
          <SearchableSelect
            id={`${uid}-status`}
            value={form.status}
            onChange={(v) => set("status", v)}
            options={[
              { value: "active", label: "Active" },
              { value: "former", label: "Former", hint: "No longer dealt with; kept for history" },
              { value: "blocked", label: "Blocked", hint: "Nothing new may be raised against them" },
            ]}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-kyc`} className={lbl}>
            KYC
          </label>
          <SearchableSelect
            id={`${uid}-kyc`}
            value={form.kycStatus}
            onChange={(v) => set("kycStatus", v)}
            options={[
              { value: "not_started", label: "Not started" },
              { value: "pending", label: "Pending" },
              { value: "verified", label: "Verified" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-notes`} className={lbl}>
            Notes
          </label>
          <RichTextEditor id={`${uid}-notes`} value={form.notes} onChange={(html) => set("notes", html)} placeholder="Anything worth knowing before somebody deals with them" />
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------- roles, aliases ------------------------ */

function RolesPanel({ cp, onSaved }: { cp: Counterparty; onSaved: (c: Counterparty, text: string) => void }) {
  const uid = useId();
  const [roles, setRoles] = useState<CounterpartyRole[]>(cp.roles);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = [...roles].sort().join() !== [...cp.roles].sort().join();

  const save = async () => {
    if (roles.length === 0) {
      setError("Keep at least one role.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const saved = await orgFoundations.counterparties.setRoles(cp.id, roles);
      setRoles(saved.roles);
      onSaved(saved, "Roles saved.");
    } catch (err) {
      setError(errorText(err, "The roles weren't saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Roles" subtitle="What they are to you. Pickers across the suite filter by these." icon={UserCheck} hue="grape">
      <p id={`${uid}-label`} className="sr-only">
        Roles
      </p>
      <RolePicker value={roles} onChange={setRoles} labelledBy={`${uid}-label`} />
      {error && <FieldError message={error} />}
      {changed && (
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save roles"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRoles(cp.roles)} disabled={busy}>
            Undo
          </Button>
        </div>
      )}
    </Panel>
  );
}

function AliasesPanel({ cp, onSaved }: { cp: Counterparty; onSaved: (c: Counterparty, text: string) => void }) {
  const uid = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const alias = text.trim();
    if (!alias) return;
    setError(null);
    setBusy(true);
    try {
      const saved = await orgFoundations.counterparties.addAlias(cp.id, alias);
      setText("");
      onSaved(saved, `"${alias}" added as another name.`);
    } catch (err) {
      // 422: another company already goes by it.
      setError(errorText(err, "The name wasn't added."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: { id: string; alias: string }) => {
    setError(null);
    try {
      await orgFoundations.counterparties.removeAlias(cp.id, a.id);
      onSaved({ ...cp, aliases: cp.aliases.filter((x) => x.id !== a.id) }, `"${a.alias}" removed.`);
    } catch (err) {
      setError(errorText(err, "The name wasn't removed."));
    }
  };

  return (
    <Panel
      title="Other names"
      subtitle="How they appear on bank statements and receipts. Incoming lines that match one are matched to them."
      icon={Tags}
      hue="sky"
    >
      {cp.aliases.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Other names">
          {cp.aliases.map((a) => (
            <li key={a.id} className="inline-flex items-center gap-1 rounded-full bg-sky-50 py-1 pl-3 pr-1 text-xs font-semibold text-sky-700">
              {a.alias}
              <button
                type="button"
                onClick={() => void remove(a)}
                aria-label={`Remove ${a.alias}`}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full hover:bg-sky-100"
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-neutral-500">None yet. Add how their name is shortened on statements, like &quot;ACME NIG LTD&quot;.</p>
      )}
      <form onSubmit={add} className="flex gap-2" aria-label="Add another name">
        <label htmlFor={`${uid}-alias`} className="sr-only">
          Another name
        </label>
        <input
          id={`${uid}-alias`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={255}
          placeholder="For example ACME NIG LTD"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-alias-err` : undefined}
          className={inputClass}
        />
        <Button type="submit" icon={Plus} disabled={busy || !text.trim()} aria-label="Add name">
          <span className="hidden sm:inline">Add</span>
        </Button>
      </form>
      <FieldError id={`${uid}-alias-err`} message={error ?? undefined} />
    </Panel>
  );
}

/* ---------------------------- bank accounts ------------------------- */

const STAGE: Record<ReturnType<typeof bankStage>, { label: string; hue: "sun" | "mint" | "rose" | "slate"; icon: typeof Clock }> = {
  pending: { label: "Awaiting approval", hue: "sun", icon: Clock },
  active: { label: "Approved", hue: "mint", icon: Check },
  rejected: { label: "Rejected", hue: "rose", icon: CircleX },
  retired: { label: "Retired", hue: "slate", icon: X },
};

export function BankAccountCard({
  cp,
  account: a,
  userId,
  onChanged,
}: {
  cp: Counterparty;
  account: BankAccount;
  userId: string | null;
  onChanged: (c: Counterparty, text: string) => void;
}) {
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [viaApprovals, setViaApprovals] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const stage = bankStage(a);
  const s = STAGE[stage];
  const steps = bankTimeline(a);
  const own = stage === "pending" && Boolean(userId) && a.requestedBy?.id === userId;

  const fail = (err: unknown, fallback: string) => {
    const message = errorText(err, fallback);
    setError(message);
    setViaApprovals(goesThroughApprovals(message));
  };

  const approve = async () => {
    setError(null);
    setBusy(true);
    try {
      const saved = await orgFoundations.counterparties.approveBankAccount(cp.id, a.id);
      onChanged(saved, `${a.bankName} ${a.number} approved.`);
    } catch (err) {
      fail(err, "The account wasn't approved.");
    } finally {
      setBusy(false);
    }
  };

  const retire = async () => {
    const ok = await confirm({
      title: `Retire ${a.bankName} ${a.number}?`,
      body: "No new payments go to it. Past payments keep it on record.",
      confirmLabel: "Retire account",
    });
    if (!ok) return;
    setError(null);
    try {
      const saved = await orgFoundations.counterparties.retireBankAccount(cp.id, a.id);
      onChanged(saved, `${a.bankName} ${a.number} retired.`);
    } catch (err) {
      fail(err, "The account wasn't retired.");
    }
  };

  return (
    <li className={cx("rounded-[1.25rem] border p-4", stage === "pending" ? "border-sun-500/40 bg-sun-50/40" : "border-neutral-100 bg-white shadow-sm")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
            {a.bankName}
            <span className="font-mono tabular-nums text-neutral-700">{a.number}</span>
            <span className="text-xs font-medium text-neutral-500">{a.currency}</span>
            {a.isDefault && <Chip hue="blue">Default</Chip>}
          </p>
          <p className="mt-0.5 text-sm text-neutral-600">{a.accountName}</p>
        </div>
        <Chip hue={s.hue} icon={s.icon}>
          {s.label}
        </Chip>
      </div>

      {/* Maker -> checker, as a two-step timeline. */}
      <ol className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Approval history">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-2.5">
            {step.who ? (
              <FaceAvatar name={step.who} size={28} />
            ) : (
              <span
                className={cx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  step.tone === "waiting" ? "ws-hatch text-sun-700" : "bg-neutral-100 text-neutral-500",
                )}
                aria-hidden
              >
                <Clock size={13} />
              </span>
            )}
            <div className="min-w-0 text-xs">
              <p className={cx("font-semibold", step.tone === "refused" ? "text-rose-700" : step.tone === "waiting" ? "text-sun-700" : "text-neutral-800")}>{step.label}</p>
              <p className="text-neutral-500">
                {step.who ? `by ${step.who}` : step.tone === "waiting" ? "Not the person who entered it" : ""}
                {step.when ? ` · ${dateLabel(step.when)}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {stage === "rejected" && a.rejectionReason && <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">Reason: {a.rejectionReason}</p>}

      {error && (
        <div role="alert" className="mt-3 rounded-2xl border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-700">
          {error}
          {viaApprovals && (
            <Link href="/suite/approvals" className="ml-1 font-semibold underline underline-offset-2">
              Open Approvals
            </Link>
          )}
        </div>
      )}

      {stage === "pending" && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sun-500/20 pt-3">
          {cp.bankChangesViaApprovals && (
            <ButtonLink href="/suite/approvals" size="sm" icon={ArrowUpRight}>
              Decide in Approvals
            </ButtonLink>
          )}
          {own ? (
            <p className="text-xs text-neutral-500">You entered these details, so someone else has to approve them.</p>
          ) : cp.bankChangesViaApprovals ? null : (
            <>
              <Button size="sm" variant="ghost" icon={Check} onClick={() => void approve()} disabled={busy || !mayCheck(a, userId)}>
                Approve here
              </Button>
              <Button size="sm" variant="ghost" icon={X} onClick={() => setRejecting(true)} disabled={busy}>
                Reject
              </Button>
            </>
          )}
        </div>
      )}
      {stage === "active" && (
        <div className="mt-4 flex justify-end border-t border-neutral-100 pt-3">
          <Button size="sm" variant="ghost" onClick={() => void retire()}>
            Retire account
          </Button>
        </div>
      )}

      {rejecting && (
        <RejectDialog
          account={a}
          onClose={() => setRejecting(false)}
          onReject={async (reason) => {
            try {
              const saved = await orgFoundations.counterparties.rejectBankAccount(cp.id, a.id, reason);
              setRejecting(false);
              onChanged(saved, `${a.bankName} ${a.number} rejected.`);
            } catch (err) {
              setRejecting(false);
              fail(err, "The account wasn't rejected.");
            }
          }}
        />
      )}
    </li>
  );
}

function RejectDialog({ account, onClose, onReject }: { account: BankAccount; onClose: () => void; onReject: (reason: string) => Promise<void> }) {
  const uid = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <DialogFrame
      as="form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reason.trim()) {
          setError("Say why, so whoever entered them can put it right.");
          return;
        }
        setBusy(true);
        await onReject(reason.trim());
        setBusy(false);
      }}
      titleId={`${uid}-title`}
      title={`Reject ${account.bankName} ${account.number}?`}
      subtitle="The details stay on record as rejected. Whoever entered them can add corrected ones."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? "Rejecting…" : "Reject bank details"}
          </Button>
        </div>
      }
    >
      <div>
        <label htmlFor={`${uid}-reason`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Reason
        </label>
        <textarea
          id={`${uid}-reason`}
          rows={3}
          maxLength={255}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={textareaClass}
        />
        <FieldError message={error ?? undefined} />
      </div>
    </DialogFrame>
  );
}

function RequestAccountDialog({ cp, onClose, onSaved }: { cp: Counterparty; onClose: () => void; onSaved: (c: Counterparty) => void }) {
  const uid = useId();
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountName, setAccountName] = useState(cp.legalName ?? cp.name);
  const [accountNumber, setAccountNumber] = useState("");
  const [currency, setCurrency] = useState(cp.defaultCurrency ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lbl = "mb-1.5 block text-sm font-medium text-neutral-700";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!bankName.trim()) found.bankName = "Name the bank.";
    if (!accountName.trim()) found.accountName = "Type the name on the account.";
    if (!/^[0-9A-Za-z -]{4,40}$/.test(accountNumber.trim())) found.accountNumber = "Type the account number (digits and letters only).";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const saved = await orgFoundations.counterparties.requestBankAccount(cp.id, {
        bankName: bankName.trim(),
        bankCode: bankCode.trim() || null,
        accountName: accountName.trim(),
        accountNumber: accountNumber.replace(/\s+/g, ""),
        currency: currency || null,
      });
      onSaved(saved);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err, "The bank account wasn't added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={`Add a bank account for ${cp.name}`}
      subtitle="Someone other than you has to approve it before any payment can go to it. After saving, only the last four digits are shown."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Sending…" : "Send for approval"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div>
          <label htmlFor={`${uid}-bank`} className={lbl}>
            Bank
          </label>
          <input id={`${uid}-bank`} value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={120} aria-invalid={errors.bankName ? true : undefined} className={inputClass} />
          <FieldError message={errors.bankName} />
        </div>
        <div>
          <label htmlFor={`${uid}-code`} className={lbl}>
            Bank code <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input id={`${uid}-code`} value={bankCode} onChange={(e) => setBankCode(e.target.value)} maxLength={16} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-acname`} className={lbl}>
          Account name
        </label>
        <input id={`${uid}-acname`} value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={255} aria-invalid={errors.accountName ? true : undefined} className={inputClass} />
        <FieldError message={errors.accountName} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <div>
          <label htmlFor={`${uid}-number`} className={lbl}>
            Account number
          </label>
          <input
            id={`${uid}-number`}
            inputMode="numeric"
            autoComplete="off"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            maxLength={40}
            aria-invalid={errors.accountNumber ? true : undefined}
            className={cx(inputClass, "font-mono tabular-nums")}
          />
          <FieldError message={errors.accountNumber} />
        </div>
        <div>
          <label htmlFor={`${uid}-cur`} className={lbl}>
            Currency
          </label>
          <CurrencySelect id={`${uid}-cur`} value={currency} onChange={setCurrency} clearable placeholder="Default" />
        </div>
      </div>
    </DialogFrame>
  );
}
