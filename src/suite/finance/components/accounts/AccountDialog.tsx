"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { ApiError, errorText, ledger, type Account, type AccountInput, type AccountType, type CashFlowClass } from "@/lib/api/finance-ledger-client";
import { Button, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { CurrencySelect, FieldError } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { ACCOUNT_TYPES, CASH_FLOW, SUBTYPES, familyOf, systemKeyLabel } from "./meta";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Add an account, or change one. Once anything is posted to an account its
 * code and type are fixed (the API says so too); it can still be renamed,
 * switched off, given another name statements use, or made the account the
 * software posts a purpose to.
 */

const DIMS = [
  { key: "requiresCostCentre", label: "Cost centre" },
  { key: "requiresProject", label: "Project" },
  { key: "requiresCounterparty", label: "Client or vendor" },
  { key: "requiresPerson", label: "Person" },
] as const;

type DimKey = (typeof DIMS)[number]["key"];

/** API field (camel or snake) → the form field it belongs to. */
const FIELD: Record<string, string> = {
  code: "code",
  name: "name",
  type: "type",
  subtype: "subtype",
  parentId: "parentId",
  parent_id: "parentId",
  systemKey: "systemKey",
  system_key: "systemKey",
  currency: "currency",
  cashFlow: "cashFlow",
  cash_flow: "cashFlow",
  alias: "alias",
};

export function AccountDialog({
  account,
  accounts,
  systemKeys,
  onClose,
  onSaved,
}: {
  account: Account | null;
  accounts: Account[];
  systemKeys: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const uid = useId();
  const { user } = useAuth();
  const confirm = useConfirm();
  const editing = account !== null;
  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [parentId, setParentId] = useState(account?.parentId ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "expense");
  const [subtype, setSubtype] = useState(account?.subtype ?? "");
  const [isHeading, setIsHeading] = useState(false);
  const [dims, setDims] = useState<Record<DimKey, boolean>>({
    requiresCostCentre: account?.requiresCostCentre ?? false,
    requiresProject: account?.requiresProject ?? false,
    requiresCounterparty: account?.requiresCounterparty ?? false,
    requiresPerson: account?.requiresPerson ?? false,
  });
  const [currency, setCurrency] = useState(account?.currency ?? "");
  const [cashFlow, setCashFlow] = useState<CashFlowClass | "">(account?.cashFlow === "operating" ? "" : (account?.cashFlow ?? ""));
  const [description, setDescription] = useState(account?.description ?? "");
  const [active, setActive] = useState(account?.active ?? true);
  const [systemKey, setSystemKey] = useState(account?.systemKey ?? "");
  const [aliases, setAliases] = useState(account?.aliases ?? []);
  const [alias, setAlias] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const parent = parentId ? byId.get(parentId) : undefined;
  const hasChildren = editing && accounts.some((a) => a.parentId === account.id);

  const parentOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.level < 4 && a.id !== account?.id)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        .map((a) => ({
          value: a.id,
          label: `${a.code} ${a.name}`,
          hint: !a.isPostable ? "Heading" : a.used ? "Has postings, so it can't hold accounts" : "Becomes a heading",
          disabled: a.isPostable && a.used,
        })),
    [accounts, account],
  );

  /* Under a parent, only types of the parent's family are allowed. */
  const typeOptions = ACCOUNT_TYPES.filter((t) => !parent || familyOf(t.key) === familyOf(parent.type));
  const subtypes = SUBTYPES[type] ?? [];
  const keyHolder = (k: string) => accounts.find((a) => a.systemKey === k && a.id !== account?.id);

  const chooseParent = (id: string) => {
    setParentId(id);
    const p = byId.get(id);
    if (p) {
      if (familyOf(p.type) !== familyOf(type)) setType(p.type);
      if (p.subtype) setSubtype(p.subtype);
    }
  };

  const spread = (e: unknown) => {
    if (e instanceof ApiError && e.errors) {
      const out: Record<string, string> = {};
      const rest: string[] = [];
      for (const [k, v] of Object.entries(e.errors)) {
        const f = FIELD[k];
        const msg = String((v as string[])[0] ?? "");
        if (f) out[f] = msg;
        else rest.push(msg);
      }
      setErrors(out);
      setGeneral(rest.length ? rest.join(" ") : null);
    } else {
      setErrors({});
      setGeneral(errorText(e));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!code.trim()) local.code = "Give the account a code.";
    if (!name.trim()) local.name = "Give the account a name.";
    setErrors(local);
    setGeneral(null);
    if (Object.keys(local).length) return;

    const input: AccountInput = {
      code: code.trim(),
      name: name.trim(),
      type,
      subtype: subtypes.length ? subtype || null : null,
      ...dims,
      currency: currency || null,
      cashFlow: cashFlow || null,
      description: description.trim() || null,
    };
    setBusy(true);
    try {
      if (editing) {
        await ledger.accounts.update(account.id, {
          ...input,
          active,
          ...(systemKey !== (account.systemKey ?? "") ? { systemKey: systemKey || null } : {}),
        });
        onSaved(`${code.trim()} ${name.trim()} saved.`);
      } else {
        await ledger.accounts.create({ ...input, parentId: parentId || null, isHeading, ...(systemKey && !isHeading ? { systemKey } : {}) });
        onSaved(`${code.trim().toUpperCase()} ${name.trim()} added.`);
      }
    } catch (err) {
      spread(err);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!account) return;
    if (!(await confirm({ title: `Delete ${account.code} ${account.name}?`, body: "Nothing has been posted to it, so the books don't change. The account cannot be brought back.", confirmLabel: "Delete account" }))) return;
    setBusy(true);
    try {
      await ledger.accounts.remove(account.id);
      onSaved(`${account.code} ${account.name} deleted.`);
    } catch (err) {
      spread(err);
      setBusy(false);
    }
  };

  const addAlias = async () => {
    if (!account || !alias.trim()) return;
    try {
      const a = await ledger.accounts.addAlias(account.id, alias.trim());
      setAliases(a.aliases);
      setAlias("");
      setErrors((x) => ({ ...x, alias: "" }));
    } catch (err) {
      spread(err);
    }
  };

  const removeAlias = async (id: string, text: string) => {
    if (!account) return;
    if (!(await confirm({ title: `Remove “${text}”?`, body: "Statement lines that use this name will no longer find this account by it.", confirmLabel: "Remove name" }))) return;
    try {
      await ledger.accounts.removeAlias(account.id, id);
      setAliases((xs) => xs.filter((x) => x.id !== id));
    } catch (err) {
      spread(err);
    }
  };

  const label = (f: string, text: string, extra?: React.ReactNode) => (
    <label htmlFor={`${uid}-${f}`} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-neutral-700">
      <span>{text}</span>
      {extra && <span className="text-xs font-normal text-neutral-500">{extra}</span>}
    </label>
  );
  const err = (f: string) => <FieldError id={`${uid}-${f}-err`} message={errors[f]} />;
  const described = (f: string) => (errors[f] ? `${uid}-${f}-err` : undefined);
  const canDelete = editing && !account.used && !hasChildren && !account.systemKey && mayDo(user, "accounts", "delete");

  return (
    <DialogFrame
      titleId={`${uid}-title`}
      title={editing ? `${account.code} ${account.name}` : "New account"}
      subtitle={editing ? (account.used ? "This account has postings: its code and type are fixed." : "Nothing is posted to this account yet.") : "Codes are unique. Only accounts without children take postings."}
      onClose={onClose}
      as="form"
      onSubmit={submit}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {canDelete && (
              <Button variant="ghost" icon={Trash2} onClick={remove} disabled={busy} className="text-error-700 hover:bg-error-500/10 hover:text-error-700">
                Delete account
              </Button>
            )}
          </span>
          <span className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save account" : "Add account"}
            </Button>
          </span>
        </div>
      }
    >
      {general && <ErrorNote>{general}</ErrorNote>}

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          {label("code", "Code", editing && account.used ? "Fixed" : undefined)}
          <input
            id={`${uid}-code`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={16}
            disabled={editing && account.used}
            aria-invalid={Boolean(errors.code) || undefined}
            aria-describedby={described("code")}
            className={cx(inputClass, "font-mono uppercase")}
            placeholder="6110"
          />
          {err("code")}
        </div>
        <div>
          {label("name", "Name")}
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={160} aria-invalid={Boolean(errors.name) || undefined} aria-describedby={described("name")} className={inputClass} placeholder="Electricity and power" />
          {err("name")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          {label("parentId", "Sits under", editing ? undefined : "Optional")}
          {editing ? (
            <p className="flex h-11 items-center text-sm text-neutral-700">{parent ? `${parent.code} ${parent.name}` : "Top of the chart"}</p>
          ) : (
            <SearchableSelect
              id={`${uid}-parentId`}
              value={parentId}
              onChange={chooseParent}
              options={parentOptions}
              clearable
              clearLabel="Top of the chart"
              placeholder="Top of the chart"
              searchPlaceholder="Search code or name"
              aria-invalid={Boolean(errors.parentId) || undefined}
              aria-describedby={described("parentId")}
            />
          )}
          {err("parentId")}
        </div>
        <div>
          {label("type", "Type", editing && account.used ? "Fixed" : undefined)}
          <SearchableSelect
            id={`${uid}-type`}
            value={type}
            onChange={(v) => {
              setType(v as AccountType);
              setSubtype("");
            }}
            options={typeOptions.map((t) => ({ value: t.key, label: t.label }))}
            disabled={editing && account.used}
            aria-invalid={Boolean(errors.type) || undefined}
            aria-describedby={described("type")}
          />
          {err("type")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {subtypes.length > 0 && (
          <div>
            {label("subtype", "Shown on the balance sheet as")}
            <SearchableSelect id={`${uid}-subtype`} value={subtype} onChange={setSubtype} options={subtypes.map((s) => ({ value: s.key, label: s.label }))} placeholder="Choose where it sits" />
          </div>
        )}
        <div>
          {label("cashFlow", "In the cash flow, as")}
          <SearchableSelect
            id={`${uid}-cashFlow`}
            value={cashFlow}
            onChange={(v) => setCashFlow(v as CashFlowClass | "")}
            options={[{ value: "", label: "Operating" }, ...CASH_FLOW.filter((c) => c.key !== "operating").map((c) => ({ value: c.key, label: c.label }))]}
          />
        </div>
        <div>
          {label("currency", "Currency", "Leave empty to take any")}
          <CurrencySelect id={`${uid}-currency`} value={currency} onChange={setCurrency} clearable placeholder="Any currency" invalid={Boolean(errors.currency)} describedBy={described("currency")} />
          {err("currency")}
        </div>
      </div>

      {!editing && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-3.5">
          <input type="checkbox" checked={isHeading} onChange={(e) => setIsHeading(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary-600" />
          <span className="text-sm">
            <span className="font-medium text-neutral-900">A heading</span>
            <span className="block text-xs text-neutral-500">Groups other accounts and takes no postings itself.</span>
          </span>
        </label>
      )}

      {!isHeading && (account?.isPostable ?? true) && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">Every line on this account must carry</legend>
          <div className="grid gap-2 sm:grid-cols-4">
            {DIMS.map((d) => (
              <label key={d.key} className={cx("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm", dims[d.key] ? "border-primary-300 bg-primary-50 text-primary-700" : "border-neutral-200 text-neutral-700")}>
                <input type="checkbox" checked={dims[d.key]} onChange={(e) => setDims((x) => ({ ...x, [d.key]: e.target.checked }))} className="h-4 w-4 accent-primary-600" />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        {label("description", "Description", "Optional")}
        <RichTextEditor id={`${uid}-description`} minHeight={72} value={description} onChange={setDescription} placeholder="What belongs here, for whoever keys a journal" />
      </div>

      {editing && (
        <>
          <div>
            {label("systemKey", "The software posts here for", "Optional")}
            <SearchableSelect
              id={`${uid}-systemKey`}
              value={systemKey}
              onChange={setSystemKey}
              options={systemKeys.map((k) => {
                const holder = keyHolder(k);
                return { value: k, label: systemKeyLabel(k), hint: holder ? `Now on ${holder.code} ${holder.name}` : "Not set yet" };
              })}
              clearable
              clearLabel="Nothing automatic"
              placeholder="Nothing automatic"
              searchPlaceholder="Search purposes"
              aria-invalid={Boolean(errors.systemKey) || undefined}
              aria-describedby={described("systemKey")}
            />
            <p className="mt-1.5 text-xs text-neutral-500">Choosing a purpose another account has moves it here.</p>
            {err("systemKey")}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-neutral-700">Other names on bank statements</span>
            {aliases.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Other names">
                {aliases.map((x) => (
                  <li key={x.id} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1 text-xs font-semibold text-neutral-700">
                    {x.alias}
                    <button type="button" onClick={() => removeAlias(x.id, x.alias)} aria-label={`Remove ${x.alias}`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-primary-300">
                      <X size={12} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                aria-label="Another name"
                value={alias}
                maxLength={160}
                onChange={(e) => setAlias(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addAlias();
                  }
                }}
                aria-invalid={Boolean(errors.alias) || undefined}
                aria-describedby={described("alias")}
                className={inputClass}
                placeholder="e.g. NEPA, IKEJA ELECTRIC"
              />
              <Button icon={Plus} onClick={addAlias} disabled={!alias.trim()}>
                Add
              </Button>
            </div>
            {err("alias")}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Open for posting</p>
              <p className="mt-0.5 text-xs text-neutral-500">Switched off, it keeps its history but takes no new lines.</p>
            </div>
            <Switch checked={active} onChange={setActive} label="Open for posting" disabled={Boolean(account.systemKey) && active} />
          </div>
        </>
      )}
    </DialogFrame>
  );
}
