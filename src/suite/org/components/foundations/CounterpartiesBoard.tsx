"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Clock, Handshake, Landmark, Plus, ShieldCheck, ShieldQuestion, ShieldX, Store, Users } from "lucide-react";
import { orgFoundations, type CounterpartyRole, type CounterpartySummary } from "@/lib/api/org-foundations-client";
import { Button, Chip, Empty, PageHeader, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, IconTile, Skeleton, StatCard, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import type { Hue } from "@/components/workspace/modules";
import { CurrencySelect, FieldError, LoadError, errorText, fieldErrors } from "./shared";
import { SHORT_CODE, SHORT_CODE_ERROR, SHORT_CODE_HINT } from "./logic";

/**
 * Clients and vendors: every company or person the organisation deals with,
 * in one register. One record can be a client and a vendor at once; projects,
 * purchases and invoices all pick from here.
 */

export const ROLES: { key: CounterpartyRole; label: string; plural: string; hue: Hue }[] = [
  { key: "client", label: "Client", plural: "Clients", hue: "blue" },
  { key: "vendor", label: "Vendor", plural: "Vendors", hue: "grape" },
  { key: "partner", label: "Partner", plural: "Partners", hue: "mint" },
  { key: "subcontractor", label: "Subcontractor", plural: "Subcontractors", hue: "coral" },
  { key: "regulator", label: "Regulator", plural: "Regulators", hue: "sky" },
];

export const roleMeta = (r: CounterpartyRole) => ROLES.find((x) => x.key === r) ?? ROLES[0];

export function RoleChips({ roles }: { roles: CounterpartyRole[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Chip key={r} hue={roleMeta(r).hue} className="!px-2 !py-0.5 !text-[11px]">
          {roleMeta(r).label}
        </Chip>
      ))}
    </span>
  );
}

export const KYC: Record<CounterpartySummary["kycStatus"], { label: string; hue: Hue; icon: typeof ShieldCheck }> = {
  not_started: { label: "KYC not started", hue: "slate", icon: ShieldQuestion },
  pending: { label: "KYC pending", hue: "sun", icon: Clock },
  verified: { label: "KYC verified", hue: "mint", icon: ShieldCheck },
  rejected: { label: "KYC rejected", hue: "rose", icon: ShieldX },
};

export function KycChip({ status }: { status: CounterpartySummary["kycStatus"] }) {
  const k = KYC[status] ?? KYC.not_started;
  return (
    <Chip hue={k.hue} icon={k.icon}>
      {k.label}
    </Chip>
  );
}

export const STATUS: Record<CounterpartySummary["status"], { label: string; hue: Hue }> = {
  active: { label: "Active", hue: "mint" },
  former: { label: "Former", hue: "slate" },
  blocked: { label: "Blocked", hue: "rose" },
};

type RoleTab = "all" | CounterpartyRole;
type StatusFilter = "active" | "former" | "blocked" | "all";

export default function CounterpartiesBoard() {
  const router = useRouter();
  const [rows, setRows] = useState<CounterpartySummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<RoleTab>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    orgFoundations.counterparties
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e, "Clients and vendors didn't load.")));
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const shown = useMemo(
    () => all.filter((c) => (tab === "all" || c.roles.includes(tab)) && (status === "all" || c.status === status)),
    [all, tab, status],
  );
  const stats = useMemo(
    () => ({
      clients: all.filter((c) => c.roles.includes("client") && c.status === "active").length,
      vendors: all.filter((c) => c.roles.includes("vendor") && c.status === "active").length,
      pending: all.reduce((n, c) => n + c.pendingAccounts, 0),
      unverified: all.filter((c) => c.status === "active" && c.kycStatus !== "verified").length,
    }),
    [all],
  );

  const name = (c: CounterpartySummary, big = false) => (
    <span className="flex min-w-0 items-center gap-3">
      <IconTile icon={c.kind === "individual" ? Users : c.kind === "government" ? Landmark : Building2} hue={roleMeta(c.roles[0] ?? "client").hue} size={big ? 40 : 34} />
      <span className="min-w-0">
        <span className={big ? "block truncate text-[15px] font-semibold text-neutral-900" : "block truncate font-medium text-neutral-900"}>{c.name}</span>
        {(c.code || c.shortCode) && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-500">
            {c.code}
            {c.shortCode && (
              <span title="Short code, printed in reference numbers" className="rounded-md bg-primary-50 px-1.5 py-px font-semibold text-primary-700">
                <span className="sr-only">Short code </span>
                {c.shortCode}
              </span>
            )}
          </span>
        )}
      </span>
    </span>
  );

  const accounts = (c: CounterpartySummary) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="tabular-nums text-neutral-700">
        {c.activeAccounts} {c.activeAccounts === 1 ? "account" : "accounts"}
      </span>
      {c.pendingAccounts > 0 && (
        <Chip hue="sun" icon={Clock} className="!px-2 !py-0.5 !text-[11px]">
          {c.pendingAccounts} awaiting approval
        </Chip>
      )}
    </span>
  );

  const columns: Column<CounterpartySummary>[] = [
    { key: "name", header: "Name", primary: true, sortable: true, value: (c) => `${c.name} ${c.code ?? ""} ${c.shortCode ?? ""} ${c.legalName ?? ""}`, render: (c) => name(c) },
    { key: "roles", header: "Roles", value: (c) => c.roles.map((r) => roleMeta(r).label).join(", "), render: (c) => <RoleChips roles={c.roles} /> },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (c) => STATUS[c.status].label,
      render: (c) => (
        <Chip hue={STATUS[c.status].hue} dot>
          {STATUS[c.status].label}
        </Chip>
      ),
    },
    { key: "kyc", header: "KYC", sortable: true, value: (c) => KYC[c.kycStatus].label, render: (c) => <KycChip status={c.kycStatus} />, hideOnMobile: true },
    { key: "accounts", header: "Bank accounts", sortable: true, value: (c) => c.activeAccounts + c.pendingAccounts, render: accounts },
    { key: "sector", header: "Sector", sortable: true, value: (c) => c.sector ?? "", hideOnMobile: true },
  ];

  const countFor = (k: RoleTab) => (rows ? all.filter((c) => k === "all" || c.roles.includes(k)).length : undefined);

  return (
    <div>
      <PageHeader
        eyebrow="Organisation"
        title="Clients and vendors"
        subtitle="Everyone you sell to, buy from or work with, in one register. Projects, purchases and invoices pick from here."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New client or vendor
          </Button>
        }
        tabs={[{ key: "all", label: "All", count: countFor("all") }, ...ROLES.map((r) => ({ key: r.key, label: r.plural, count: countFor(r.key) }))]}
        activeTab={tab}
        onTab={(k) => setTab(k as RoleTab)}
      />

      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}

      <div className="mb-5">
        <StatGrid cols={4}>
          <StatCard featured label="Active clients" value={rows ? stats.clients : "—"} icon={Handshake} />
          <StatCard label="Active vendors" value={rows ? stats.vendors : "—"} icon={Store} hue="grape" />
          <StatCard
            label="Bank details awaiting approval"
            value={rows ? stats.pending : "—"}
            icon={Clock}
            hue="sun"
            hint={stats.pending > 0 ? "A second person has to check them" : "Nothing waiting"}
            href={stats.pending > 0 ? "/suite/approvals" : undefined}
          />
          <StatCard label="Active, not KYC-verified" value={rows ? stats.unverified : "—"} icon={ShieldQuestion} hue="coral" />
        </StatGrid>
      </div>

      {rows === null && !loadError ? (
        <div aria-busy="true">
          <p className="sr-only">Loading clients and vendors…</p>
          <Skeleton className="h-[360px]" />
        </div>
      ) : rows !== null ? (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(c) => c.id}
          rowHref={(c) => `/suite/org/counterparties/${c.id}`}
          storageKey="org.counterparties"
          caption="Clients and vendors"
          searchPlaceholder="Search by name or code"
          toolbar={
            <Segmented
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { key: "active", label: "Active" },
                { key: "former", label: "Former" },
                { key: "blocked", label: "Blocked" },
                { key: "all", label: "All" },
              ]}
            />
          }
          empty={
            rows.length === 0 ? (
              <Empty
                icon={Handshake}
                title="No clients or vendors yet."
                hint="Add the companies and people you deal with. Each needs at least one role."
                action={
                  <Button icon={Plus} onClick={() => setCreating(true)}>
                    Add the first
                  </Button>
                }
              />
            ) : (
              <Empty icon={Handshake} title="Nobody matches." hint="Try another tab, status or search." />
            )
          }
          renderCard={(c) => (
            <div className="flex h-full flex-col gap-3 p-5">
              {name(c, true)}
              <RoleChips roles={c.roles} />
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs">
                <KycChip status={c.kycStatus} />
                {accounts(c)}
              </div>
            </div>
          )}
        />
      ) : null}

      {creating && (
        <NewCounterpartyDialog
          defaultRole={tab === "all" ? null : tab}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            router.push(`/suite/org/counterparties/${id}`);
          }}
        />
      )}
    </div>
  );
}

/** Role toggles: pressed buttons with words, so the choice never rests on colour. */
export function RolePicker({ value, onChange, labelledBy }: { value: CounterpartyRole[]; onChange: (v: CounterpartyRole[]) => void; labelledBy: string }) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {ROLES.map((r) => {
        const on = value.includes(r.key);
        return (
          <button
            key={r.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== r.key) : [...value, r.key])}
            className={
              on
                ? "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-primary-600 bg-primary-600 px-3.5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                : "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm font-semibold text-neutral-600 outline-none hover:border-neutral-300 focus-visible:ring-2 focus-visible:ring-primary-300"
            }
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function NewCounterpartyDialog({ defaultRole, onClose, onCreated }: { defaultRole: CounterpartyRole | null; onClose: () => void; onCreated: (id: string) => void }) {
  const uid = useId();
  const [nameText, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [kind, setKind] = useState<"organisation" | "individual" | "government">("organisation");
  const [roles, setRoles] = useState<CounterpartyRole[]>(defaultRole ? [defaultRole] : []);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tin, setTin] = useState("");
  const [currency, setCurrency] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lbl = "mb-1.5 block text-sm font-medium text-neutral-700";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (nameText.trim() === "") found.name = "Give them a name.";
    if (roles.length === 0) found.roles = "Pick at least one role.";
    if (shortCode.trim() && !SHORT_CODE.test(shortCode.trim())) found.shortCode = SHORT_CODE_ERROR;
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) found.email = "Type an email address like accounts@example.com.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const made = await orgFoundations.counterparties.create({
        name: nameText.trim(),
        legalName: legalName.trim() || null,
        shortCode: shortCode.trim().toUpperCase() || null,
        kind,
        roles,
        email: email.trim() || null,
        phone: phone.trim() || null,
        tin: tin.trim() || null,
        defaultCurrency: currency || null,
      });
      onCreated(made.id);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err, "They weren't added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title="New client or vendor"
      subtitle="Add the basics now. Tax details, aliases and bank accounts go on their page next."
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Adding…" : "Add and open"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div>
        <span id={`${uid}-roles`} className={lbl}>
          Roles
        </span>
        <RolePicker value={roles} onChange={setRoles} labelledBy={`${uid}-roles`} />
        <FieldError message={errors.roles} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-name`} className={lbl}>
            Name
          </label>
          <input id={`${uid}-name`} value={nameText} onChange={(e) => setName(e.target.value)} maxLength={255} aria-invalid={errors.name ? true : undefined} className={inputClass} />
          <FieldError message={errors.name} />
        </div>
        <div>
          <label htmlFor={`${uid}-legal`} className={lbl}>
            Legal name <span className="font-normal text-neutral-500">(if different)</span>
          </label>
          <input id={`${uid}-legal`} value={legalName} onChange={(e) => setLegalName(e.target.value)} maxLength={255} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-short`} className={lbl}>
            Short code <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input
            id={`${uid}-short`}
            value={shortCode}
            onChange={(e) => {
              setShortCode(e.target.value.toUpperCase());
              if (errors.shortCode) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.shortCode;
                  return next;
                });
              }
            }}
            maxLength={12}
            placeholder="EMMS"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={errors.shortCode ? true : undefined}
            aria-describedby={`${uid}-short-hint`}
            className={cx(inputClass, "font-mono sm:max-w-[14rem]")}
          />
          <FieldError message={errors.shortCode} />
          <p id={`${uid}-short-hint`} className="mt-1.5 text-xs text-neutral-500">
            {SHORT_CODE_HINT}
          </p>
        </div>
        <div>
          <label htmlFor={`${uid}-kind`} className={lbl}>
            Kind
          </label>
          <SearchableSelect
            id={`${uid}-kind`}
            value={kind}
            onChange={(v) => setKind(v as typeof kind)}
            options={[
              { value: "organisation", label: "Organisation" },
              { value: "individual", label: "Individual" },
              { value: "government", label: "Government body" },
            ]}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-cur`} className={lbl}>
            Default currency
          </label>
          <CurrencySelect id={`${uid}-cur`} value={currency} onChange={setCurrency} clearable placeholder="Same as ours" />
        </div>
        <div>
          <label htmlFor={`${uid}-email`} className={lbl}>
            Email
          </label>
          <input id={`${uid}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} aria-invalid={errors.email ? true : undefined} className={inputClass} />
          <FieldError message={errors.email} />
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className={lbl}>
            Phone
          </label>
          <input id={`${uid}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-tin`} className={lbl}>
            Tax ID (TIN)
          </label>
          <input id={`${uid}-tin`} value={tin} onChange={(e) => setTin(e.target.value)} maxLength={32} className={inputClass} />
        </div>
      </div>
    </DialogFrame>
  );
}
