"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Coins,
  Landmark,
  Layers,
  Percent,
  Plus,
  ReceiptText,
  UserRound,
  Wallet,
} from "lucide-react";
import { Button, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, type Hue } from "@/components/workspace/modules";
import { ModalFrame, Notice, PersonCell, hintCls, inputCls, labelCls } from "../ui2/kit";
import {
  ApiError,
  hrm,
  type LoanKind,
  type PayElement,
  type PayElementBasis,
  type PayElementKind,
  type PayProfile,
  type StatutoryKind,
  type StatutorySchedule,
} from "@/lib/api/hrm-client";
import { formatDate, nairaFromKobo } from "@/suite/hrm/lib/format";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * Setting payroll up.
 *
 * None of this could be done through a screen before: no way to define a pay
 * element, set anybody's salary, change a tax band or grant a loan. The backend
 * had all of it and the console had none of it, so payroll could be *run* and
 * never *configured*.
 *
 * Three things the forms say out loud, because each is a decision somebody
 * would otherwise have to discover: percentages of basic terminate and
 * percentages of gross can compound; a rate change supersedes rather than
 * edits; and an advance is recovered in one go rather than scheduled.
 */

/* ------------------------------------------------------------------ */
/*  Pay elements                                                       */
/* ------------------------------------------------------------------ */

const KINDS: { value: PayElementKind; label: string; hint: string }[] = [
  { value: "earning", label: "Earning", hint: "Adds to gross." },
  { value: "deduction", label: "Deduction", hint: "Comes off net pay." },
  {
    value: "employer_contribution",
    label: "Employer cost",
    hint: "Costs the institution. Never touches the employee's pay.",
  },
];

const BASES: { value: PayElementBasis; label: string; hint: string }[] = [
  { value: "fixed", label: "A fixed amount", hint: "The same figure every run." },
  {
    value: "percent_of_basic",
    label: "A percentage of basic",
    hint: "Safe to combine — basic does not move when allowances are added.",
  },
  {
    value: "percent_of_gross",
    label: "A percentage of gross",
    hint: "Taken against gross before any percentage-of-gross element is applied, so two of them cannot inflate each other.",
  },
];

export function PayElements() {
  const [rows, setRows] = useState<PayElement[] | null>(null);
  const [editing, setEditing] = useState<PayElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    () =>
      hrm.payroll
        .elements()
        .then((res) => {
          setRows(res);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const kindHue = (kind: PayElementKind): Hue =>
    kind === "earning" ? "mint" : kind === "deduction" ? "coral" : "grape";

  const howMuch = (element: PayElement) =>
    element.isPercentage
      ? `${element.ratePercent}% ${element.basis === "percent_of_basic" ? "of basic" : "of gross"}`
      : nairaFromKobo(element.amountKobo);

  const flags = (element: PayElement) =>
    [
      element.kind === "earning" && !element.isTaxable ? "not taxed" : null,
      element.kind === "earning" && !element.isPensionable ? "not pensionable" : null,
    ].filter(Boolean) as string[];

  const editButton = (element: PayElement) => (
    <button
      type="button"
      onClick={() => setEditing(element)}
      aria-label={`Edit ${element.name}`}
      className="h-9 shrink-0 cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
    >
      Edit
    </button>
  );

  const columns: Column<PayElement>[] = [
    {
      key: "name",
      header: "Element",
      primary: true,
      sortable: true,
      value: (e) => e.name,
      render: (e) => (
        <span className="flex items-center gap-3">
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[kindHue(e.kind)].soft)}>
            <Layers size={16} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{e.name}</span>
            <span className="block text-xs text-neutral-500">{e.code}</span>
          </span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "What it does",
      sortable: true,
      value: (e) => e.kindLabel,
      render: (e) => <Chip dot hue={kindHue(e.kind)}>{e.kindLabel}</Chip>,
    },
    { key: "amount", header: "Worked out as", value: (e) => howMuch(e), render: (e) => <span className="tabular-nums">{howMuch(e)}</span> },
    {
      key: "flags",
      header: "Notes",
      hideOnMobile: true,
      value: (e) => [...flags(e), e.isActive ? "" : "off"].join(" "),
      render: (e) => (
        <span className="flex flex-wrap gap-1.5">
          {!e.isActive && <Chip>Off</Chip>}
          {flags(e).map((f) => (
            <Chip key={f} hue="sun">{f}</Chip>
          ))}
          {e.isActive && flags(e).length === 0 && <span className="text-neutral-400">—</span>}
        </span>
      ),
    },
    { key: "edit", header: "", align: "right", tableOnly: true, render: editButton },
  ];

  return (
    <>
      {error !== null && <Notice tone="error" className="mb-4">{error}</Notice>}

      <Panel
        title="Pay elements"
        subtitle="Changing one affects the next calculation. Payslips already issued keep the figures they were frozen with."
        icon={Layers}
        hue="mint"
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
            Add an element
          </Button>
        }
      >
        {rows === null ? (
          <div className="h-40 animate-pulse rounded-xl bg-neutral-50" />
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(e) => e.id}
            storageKey="hrm.payroll.elements"
            caption="Pay elements"
            searchPlaceholder="Search elements"
            empty={
              <Empty
                icon={Coins}
                title="No elements yet"
                hint="Basic salary is built in. Add allowances and deductions here."
              />
            }
            renderCard={(e) => (
              <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[kindHue(e.kind)].soft)}>
                    <Layers size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-neutral-900">{e.name}</p>
                    <p className="text-xs text-neutral-500">{e.code}</p>
                  </div>
                  {editButton(e)}
                </div>
                <p className="text-xl font-bold tracking-tight tabular-nums text-neutral-900">{howMuch(e)}</p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <Chip dot hue={kindHue(e.kind)}>{e.kindLabel}</Chip>
                  {!e.isActive && <Chip>Off</Chip>}
                  {flags(e).map((f) => (
                    <Chip key={f} hue="sun">{f}</Chip>
                  ))}
                </div>
              </div>
            )}
            renderListItem={(e) => (
              <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {e.name} <span className="text-xs font-normal text-neutral-500">{e.code}</span>
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {howMuch(e)} · {e.kindLabel}
                    {flags(e).map((f) => ` · ${f}`).join("")}
                  </p>
                </div>
                {!e.isActive && <Chip>Off</Chip>}
                {editButton(e)}
              </div>
            )}
          />
        )}
      </Panel>

      {(adding || editing !== null) && (
        <ElementDialog
          existing={editing ?? undefined}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            void load();
          }}
        />
      )}
    </>
  );
}

function ElementDialog({
  existing,
  onClose,
  onSaved,
}: {
  /** Present when changing an element rather than adding one. */
  existing?: PayElement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [kind, setKind] = useState<PayElementKind>(existing?.kind ?? "earning");
  const [basis, setBasis] = useState<PayElementBasis>(
    existing?.basis ?? "percent_of_basic",
  );
  const [amount, setAmount] = useState(
    existing != null && existing.amountKobo > 0
      ? String(existing.amountKobo / 100)
      : "",
  );
  const [rate, setRate] = useState(
    existing != null && existing.rateBasisPoints > 0
      ? String(existing.rateBasisPoints / 100)
      : "25",
  );
  const [isTaxable, setIsTaxable] = useState(existing?.isTaxable ?? true);
  const [isPensionable, setIsPensionable] = useState(
    existing?.isPensionable ?? true,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        kind,
        basis,
        // Typed in naira and percent; stored in kobo and basis points so
        // nothing rounds twice.
        amountKobo: basis === "fixed" ? Math.round(Number(amount || 0) * 100) : 0,
        rateBasisPoints:
          basis === "fixed" ? 0 : Math.round(Number(rate || 0) * 100),
        isTaxable,
        isPensionable,
      };

      /*
        Changing an element governs the next run. A run already approved keeps
        the figures it was approved with — that is the whole point of a payslip
        being a record rather than a calculation repeated on demand.
      */
      if (existing !== undefined) {
        await hrm.payroll.updateElement(existing.id, payload);
      } else {
        await hrm.payroll.createElement(payload);
      }

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      label={existing !== undefined ? "Edit pay element" : "Add a pay element"}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            placeholder="Housing allowance"
            className={inputCls}
          />
        </Field>
        <Field label="Short code">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={16}
            placeholder="HOUSING"
            className={`${inputCls} uppercase`}
          />
        </Field>
      </div>

      <Field label="What it does">
        <SearchableSelect
          value={kind}
          onChange={(v) => setKind(v as PayElementKind)}
          options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
        />
        <p className={hintCls}>
          {KINDS.find((k) => k.value === kind)?.hint}
        </p>
      </Field>

      <Field label="How it is worked out">
        <SearchableSelect
          value={basis}
          onChange={(v) => setBasis(v as PayElementBasis)}
          options={BASES.map((b) => ({ value: b.value, label: b.label }))}
        />
        {/*
          The circularity warning. A percentage of gross that itself adds to
          gross is only well-defined because of the two-pass evaluation, and
          somebody configuring one deserves to know that.
        */}
        <p className={hintCls}>
          {BASES.find((b) => b.value === basis)?.hint}
        </p>
      </Field>

      {basis === "fixed" ? (
        <Field label="Amount (₦)">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            required
            className={inputCls}
          />
        </Field>
      ) : (
        <Field label="Percentage">
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            min={0}
            max={1000}
            step={0.01}
            required
            className={inputCls}
          />
        </Field>
      )}

      {kind === "earning" && (
        <div className="space-y-2.5 rounded-xl bg-neutral-50 px-3.5 py-3">
          <Check label="PAYE applies to it" checked={isTaxable} onChange={setIsTaxable} />
          <Check
            label="Pension and NHF are worked out on it"
            checked={isPensionable}
            onChange={setIsPensionable}
          />
          {/*
            Both are per element rather than inferred, which is what lets a
            non-taxable transport allowance exist without a special case in the
            calculator.
          */}
          <p className="text-xs text-neutral-500">
            A transport allowance is often neither. Overtime is taxed but not
            pensionable.
          </p>
        </div>
      )}

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Actions busy={busy} onClose={onClose} label="Add" />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Salaries                                                           */
/* ------------------------------------------------------------------ */

/**
 * The Salaries banner, in the run check's words.
 *
 * "Cannot be paid" is reserved for what the run itself refuses — no bank
 * account number. Profiles with only statutory details missing are counted
 * separately as "have details missing", so this screen and the run's "Before
 * you approve" check never disagree about who can be paid.
 */
export function salariesSummary(incomplete: number, unpayable: number): string {
  if (incomplete === 0) return "Everybody with a profile can be paid.";
  const missing = `${incomplete} ${incomplete === 1 ? "has" : "have"} details missing`;
  return unpayable > 0
    ? `${missing}. ${unpayable} cannot be paid — no bank account number.`
    : `${missing}, but everybody can be paid. Open one to see what is missing.`;
}

export function Salaries() {
  const [rows, setRows] = useState<PayProfile[] | null>(null);
  const [elements, setElements] = useState<PayElement[]>([]);
  const [incomplete, setIncomplete] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PayProfile | null>(null);

  const load = useCallback(
    () =>
      Promise.all([hrm.payroll.profiles(), hrm.payroll.elements()])
        .then(([profiles, els]) => {
          setRows(profiles.data);
          setIncomplete(profiles.meta.incomplete);
          setElements(els.filter((e) => e.isActive));
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /*
    Two different things, kept apart on purpose. "Cannot be paid" means the
    run will leave this person out (no bank account number) — the same rule
    the run's "Before you approve" check uses. Missing statutory details
    (bank code, TIN, pension PIN) are worth fixing but don't stop payment.
  */
  const status = (profile: PayProfile) =>
    !profile.canBePaid ? (
      <Chip hue="coral" icon={AlertTriangle}>
        Cannot be paid
      </Chip>
    ) : profile.missingDetails.length > 0 ? (
      <Chip hue="sun" icon={AlertTriangle}>
        {profile.missingDetails.length} missing
      </Chip>
    ) : (
      <Chip hue="mint" dot>
        Ready to pay
      </Chip>
    );

  const columns: Column<PayProfile>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      sortable: true,
      value: (p) => p.employee?.name ?? "",
      render: (p) => <PersonCell name={p.employee?.name ?? "Unnamed"} sub={p.employee?.jobTitle ?? "—"} />,
    },
    { key: "department", header: "Department", sortable: true, value: (p) => p.employee?.department ?? null, hideOnMobile: true },
    {
      key: "basic",
      header: "Monthly basic",
      align: "right",
      sortable: true,
      value: (p) => p.monthlyBasicKobo,
      render: (p) => <span className="font-semibold text-neutral-900">{nairaFromKobo(p.monthlyBasicKobo)}</span>,
    },
    {
      key: "allowances",
      header: "Allowances",
      align: "right",
      sortable: true,
      value: (p) => (p.elements ?? []).length,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (p) => (p.canBePaid ? 0 : 100) + p.missingDetails.length,
      render: status,
    },
  ];

  const unpayable = rows?.filter((p) => !p.canBePaid).length ?? 0;

  return (
    <>
      {error !== null && <Notice tone="error" className="mb-4">{error}</Notice>}

      <Panel
        title="Salaries"
        subtitle={salariesSummary(incomplete, unpayable)}
        icon={Wallet}
        hue="sky"
      >
        {rows === null ? (
          <div className="h-48 animate-pulse rounded-xl bg-neutral-50" />
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(p) => p.id}
            storageKey="hrm.payroll.salaries"
            caption="Salaries"
            searchPlaceholder="Search people"
            onRowClick={(p) => setEditing(p)}
            empty={
              <Empty
                icon={UserRound}
                title="No salaries set"
                hint="Set a salary from somebody's record before running payroll."
              />
            }
            renderCard={(p) => (
              <div className="flex h-full flex-col gap-4 p-5">
                <PersonCell size={44} name={p.employee?.name ?? "Unnamed"} sub={p.employee?.jobTitle ?? "—"} />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">A month</p>
                  <p className="text-xl font-bold tracking-tight tabular-nums text-neutral-900">{nairaFromKobo(p.monthlyBasicKobo)}</p>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  {status(p)}
                  <span className="text-xs text-neutral-500">
                    {(p.elements ?? []).length} allowances
                  </span>
                </div>
              </div>
            )}
            renderListItem={(p) => (
              <div className="flex flex-wrap items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <PersonCell name={p.employee?.name ?? "Unnamed"} sub={`${p.employee?.jobTitle ?? "—"} · ${nairaFromKobo(p.monthlyBasicKobo)} a month`} />
                </div>
                {status(p)}
              </div>
            )}
          />
        )}
      </Panel>

      {editing !== null && (
        <ProfileDialog
          profile={editing}
          elements={elements}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </>
  );
}

function ProfileDialog({
  profile,
  elements,
  onClose,
  onSaved,
}: {
  profile: PayProfile;
  elements: PayElement[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [salary, setSalary] = useState(
    String(profile.basicSalaryKobo / 100),
  );
  const [period, setPeriod] = useState<"year" | "month">(profile.salaryPeriod);
  const [bankName, setBankName] = useState(profile.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(
    profile.bankAccountNumber ?? "",
  );
  const [bankCode, setBankCode] = useState(profile.bankCode ?? "");
  const [tin, setTin] = useState(profile.taxIdentificationNumber ?? "");
  const [pensionPin, setPensionPin] = useState(profile.pensionPin ?? "");
  const [nhfNumber, setNhfNumber] = useState(profile.nhfNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState("");
  const confirm = useConfirm();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.payroll.saveProfile(profile.employeeId, {
        basicSalaryKobo: Math.round(Number(salary || 0) * 100),
        salaryPeriod: period,
        bankName: bankName.trim() === "" ? null : bankName.trim(),
        bankAccountNumber:
          accountNumber.trim() === "" ? null : accountNumber.trim(),
        bankCode: bankCode.trim() === "" ? null : bankCode.trim(),
        taxIdentificationNumber: tin.trim() === "" ? null : tin.trim(),
        pensionPin: pensionPin.trim() === "" ? null : pensionPin.trim(),
        nhfNumber: nhfNumber.trim() === "" ? null : nhfNumber.trim(),
      });

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  const attach = async () => {
    if (attaching === "") return;

    setBusy(true);

    try {
      await hrm.payroll.attachElement(profile.employeeId, {
        elementId: attaching,
      });
      setAttaching("");
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  const detach = async (rowId: string) => {
    const element = (profile.elements ?? []).find((row) => row.id === rowId);
    const name = element?.name ?? element?.code ?? "this pay element";
    const ok = await confirm({
      title: `Remove ${name} from ${profile.employee?.name ?? "this salary"}?`,
      body: "It stops appearing on their payslips from the next run. Payslips already produced keep it. Removing it doesn't delete the element itself, and nothing goes to the recycle bin.",
      confirmLabel: "Remove from salary",
    });
    if (!ok) return;
    setBusy(true);

    try {
      await hrm.payroll.detachElement(rowId);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const attached = profile.elements ?? [];

  return (
    <Dialog
      label={profile.employee?.name ?? "Salary"}
      onClose={onClose}
      onSubmit={save}
    >
      {/*
        What is stopping this person being paid, named rather than counted.
        "No account number, no PIN" is actionable; "incomplete" is not.
      */}
      {!profile.canBePaid ? (
        <Notice tone="warning">
          Cannot be paid yet: {profile.missingDetails.join(", ").toLowerCase()}.
        </Notice>
      ) : (
        profile.missingDetails.length > 0 && (
          <Notice tone="info">
            Can be paid, but these details are missing: {profile.missingDetails.join(", ").toLowerCase()}.
          </Notice>
        )
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Basic salary (₦)">
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            min={0}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Per">
          <SearchableSelect
            value={period}
            onChange={(v) => setPeriod(v as "year" | "month")}
            options={[
              { value: "year", label: "Year" },
              { value: "month", label: "Month" },
            ]}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bank">
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Bank code">
          <input
            type="text"
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            maxLength={16}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Account number">
        <input
          type="text"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          maxLength={32}
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tax ID">
          <input
            type="text"
            value={tin}
            onChange={(e) => setTin(e.target.value)}
            maxLength={32}
            className={inputCls}
          />
        </Field>
        <Field label="Pension PIN">
          <input
            type="text"
            value={pensionPin}
            onChange={(e) => setPensionPin(e.target.value)}
            maxLength={32}
            className={inputCls}
          />
        </Field>
        <Field label="NHF number">
          <input
            type="text"
            value={nhfNumber}
            onChange={(e) => setNhfNumber(e.target.value)}
            maxLength={32}
            className={inputCls}
          />
        </Field>
      </div>

      <div>
        <span className={labelCls}>
          Allowances and deductions
        </span>

        {attached.length > 0 && (
          <ul className="mb-2 space-y-1">
            {attached.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2"
              >
                <span className="flex-1 truncate text-xs text-neutral-700">
                  {row.name ?? row.code}
                  {row.amountKoboOverride !== null
                    ? ` · ${nairaFromKobo(row.amountKoboOverride)} for them`
                    : ""}
                  {row.endsOn !== null ? ` · ends ${formatDate(row.endsOn)}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void detach(row.id)}
                  disabled={busy}
                  className="text-xs font-semibold text-error-700 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <SearchableSelect
            value={attaching}
            onChange={setAttaching}
            className="flex-1"
            options={[
              { value: "", label: "Add one…" },
              ...elements
                .filter((e) => !attached.some((a) => a.elementId === e.id))
                .map((element) => ({ value: element.id, label: element.name })),
            ]}
          />
          <button
            type="button"
            onClick={() => void attach()}
            disabled={busy || attaching === ""}
            className="h-11 cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Actions busy={busy} onClose={onClose} label="Save" />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Statutory rates                                                    */
/* ------------------------------------------------------------------ */

export function StatutoryRates() {
  const [rows, setRows] = useState<StatutorySchedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [superseding, setSuperseding] = useState<StatutorySchedule | null>(null);

  const load = useCallback(
    () =>
      hrm.payroll
        .schedules()
        .then((res) => {
          setRows(res);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const current = (rows ?? []).filter((r) => r.isCurrent);
  const superseded = (rows ?? []).filter((r) => !r.isCurrent);

  const rate = (v: number) => (v > 0 ? `${v}%` : "—");

  const changeButton = (schedule: StatutorySchedule) => (
    <button
      type="button"
      onClick={() => setSuperseding(schedule)}
      className="h-9 shrink-0 cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
    >
      Change
    </button>
  );

  const columns: Column<StatutorySchedule>[] = [
    {
      key: "name",
      header: "Schedule",
      primary: true,
      sortable: true,
      value: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-grape-50 text-grape-700">
            <Percent size={16} aria-hidden />
          </span>
          <span className="font-semibold text-neutral-900">{r.name}</span>
        </span>
      ),
    },
    { key: "from", header: "In force from", sortable: true, value: (r) => r.effectiveFrom, render: (r) => formatDate(r.effectiveFrom) },
    { key: "employee", header: "Employee", align: "right", sortable: true, value: (r) => r.employeeRatePercent, render: (r) => rate(r.employeeRatePercent) },
    { key: "employer", header: "Employer", align: "right", sortable: true, value: (r) => r.employerRatePercent, render: (r) => rate(r.employerRatePercent) },
    {
      key: "bands",
      header: "Bands",
      align: "right",
      value: (r) => r.bands?.length ?? 0,
      render: (r) => ((r.bands?.length ?? 0) > 0 ? `${r.bands?.length} bands` : "—"),
      hideOnMobile: true,
    },
    { key: "change", header: "", align: "right", tableOnly: true, render: changeButton },
  ];

  return (
    <div className="space-y-6">
      {error !== null && <Notice tone="error">{error}</Notice>}

      <Panel
        title="Statutory rates"
        subtitle="A change supersedes rather than edits. A run keeps the rates in force on its pay date, so last March stays explainable."
        icon={Landmark}
        hue="grape"
      >
        {rows === null ? (
          <div className="h-48 animate-pulse rounded-xl bg-neutral-50" />
        ) : (
          <DataView
            rows={current}
            columns={columns}
            rowKey={(r) => r.id}
            storageKey="hrm.payroll.rates"
            defaultView="grid"
            gridCols={2}
            caption="Statutory rates in force"
            searchPlaceholder="Search rates"
            renderCard={(schedule) => (
              <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-grape-50 text-grape-700">
                    <Percent size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-neutral-900">{schedule.name}</p>
                    <p className="text-xs text-neutral-500">From {formatDate(schedule.effectiveFrom)}</p>
                  </div>
                  {changeButton(schedule)}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {/*
                    Editing a shared default creates the institution's own copy
                    rather than changing everybody's, and somebody about to do
                    it deserves to know.
                  */}
                  {schedule.isPlatformDefault && <Chip>Shared default</Chip>}
                  {schedule.employeeRatePercent > 0 && <Chip hue="sky">Employee {schedule.employeeRatePercent}%</Chip>}
                  {schedule.employerRatePercent > 0 && <Chip hue="grape">Employer {schedule.employerRatePercent}%</Chip>}
                </div>

                {schedule.bands !== undefined && schedule.bands.length > 0 && (
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <table className="w-full text-xs">
                      <tbody>
                        {schedule.bands.map((band) => (
                          <tr key={band.id}>
                            <td className="py-1 pr-3 text-neutral-600">
                              {band.isTopBand
                                ? "Everything above"
                                : `Next ${nairaFromKobo(band.widthKobo)}`}
                            </td>
                            <td className="w-24 py-1">
                              <span className="ws-hatch block h-1.5 overflow-hidden rounded-full">
                                <span
                                  className="block h-full rounded-full bg-grape-500"
                                  style={{ width: `${Math.min(100, band.ratePercent * 3)}%` }}
                                />
                              </span>
                            </td>
                            <td className="py-1 pl-3 text-right tnum font-semibold text-neutral-900">
                              {band.ratePercent}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          />
        )}
      </Panel>

      {superseded.length > 0 && (
        <Panel title="Superseded" subtitle="Kept so a past run stays explainable." icon={CalendarClock}>
          <DataView
            rows={superseded}
            rowKey={(r) => r.id}
            storageKey="hrm.payroll.rates.superseded"
            caption="Superseded statutory rates"
            searchPlaceholder="Search"
            columns={[
              { key: "name", header: "Schedule", primary: true, sortable: true, value: (r) => r.name },
              { key: "from", header: "From", sortable: true, value: (r) => r.effectiveFrom, render: (r) => formatDate(r.effectiveFrom) },
              { key: "to", header: "To", sortable: true, value: (r) => r.effectiveTo, render: (r) => formatDate(r.effectiveTo) },
            ]}
          />
        </Panel>
      )}

      {superseding !== null && (
        <SupersedeDialog
          schedule={superseding}
          onClose={() => setSuperseding(null)}
          onSaved={() => {
            setSuperseding(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function SupersedeDialog({
  schedule,
  onClose,
  onSaved,
}: {
  schedule: StatutorySchedule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [employeeRate, setEmployeeRate] = useState(
    String(schedule.employeeRatePercent),
  );
  const [employerRate, setEmployerRate] = useState(
    String(schedule.employerRatePercent),
  );
  const [bands, setBands] = useState(
    (schedule.bands ?? []).map((b) => ({
      widthKobo: b.widthKobo,
      rateBasisPoints: b.rateBasisPoints,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.payroll.supersedeSchedule({
        kind: schedule.kind as StatutoryKind,
        name: schedule.name,
        effectiveFrom,
        employeeRateBasisPoints: Math.round(Number(employeeRate || 0) * 100),
        employerRateBasisPoints: Math.round(Number(employerRate || 0) * 100),
        config: (schedule.config ?? undefined) as Record<string, unknown>,
        bands: bands.length > 0 ? bands : undefined,
      });

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label={`Change ${schedule.name}`} onClose={onClose} onSubmit={submit}>
      {/*
        The whole model, in one sentence. Somebody expecting an edit needs to
        know they are creating a version with a start date.
      */}
      <p className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-600">
        This creates a new version rather than editing the old one. Runs paid
        before the date below keep the rates they were calculated under.
      </p>

      <Field label="In force from">
        <input
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      {schedule.kind !== "paye" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee (%)">
            <input
              type="number"
              value={employeeRate}
              onChange={(e) => setEmployeeRate(e.target.value)}
              min={0}
              max={100}
              step={0.01}
              className={inputCls}
            />
          </Field>
          <Field label="Employer (%)">
            <input
              type="number"
              value={employerRate}
              onChange={(e) => setEmployerRate(e.target.value)}
              min={0}
              max={100}
              step={0.01}
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {bands.length > 0 && (
        <div>
          <span className={labelCls}>
            Bands
          </span>
          <div className="space-y-1.5">
            {bands.map((band, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs text-neutral-600">
                  {band.widthKobo === null
                    ? "Everything above"
                    : `Next ${nairaFromKobo(band.widthKobo)}`}
                </span>
                <input
                  type="number"
                  value={band.rateBasisPoints / 100}
                  onChange={(e) =>
                    setBands(
                      bands.map((b, i) =>
                        i === index
                          ? {
                              ...b,
                              rateBasisPoints: Math.round(
                                Number(e.target.value || 0) * 100,
                              ),
                            }
                          : b,
                      ),
                    )
                  }
                  min={0}
                  max={100}
                  step={0.01}
                  className="h-9 w-24 rounded-xl border border-neutral-200 bg-white px-2.5 text-sm outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                />
                <span className="text-xs text-neutral-500">%</span>
              </div>
            ))}
          </div>
          {/*
            Exactly one band has to be open-ended, or the top earners are taxed
            on part of their income only.
          */}
          <p className={hintCls}>
            The last band covers everything above, which is what stops top
            earners being taxed on part of their income only.
          </p>
        </div>
      )}

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Actions busy={busy} onClose={onClose} label="Create version" />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Granting a loan                                                    */
/* ------------------------------------------------------------------ */

export function GrantLoanDialog({
  employeeId,
  employeeName,
  onClose,
  onGranted,
}: {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
  onGranted: () => void;
}) {
  const [kind, setKind] = useState<LoanKind>("loan");
  const [principal, setPrincipal] = useState("");
  const [instalments, setInstalments] = useState("6");
  const [startsOn, setStartsOn] = useState("");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.payroll.grantLoan(employeeId, {
        kind,
        principalKobo: Math.round(Number(principal || 0) * 100),
        instalmentsTotal: kind === "salary_advance" ? 1 : Number(instalments || 1),
        startsOn: startsOn === "" ? null : startsOn,
        purpose: purpose.trim() === "" ? undefined : purpose.trim(),
      });

      onGranted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog label={`Advance to ${employeeName}`} onClose={onClose} onSubmit={submit}>
      <Field label="What kind">
        <SearchableSelect
          value={kind}
          onChange={(v) => setKind(v as LoanKind)}
          options={[
            { value: "loan", label: "Loan, repaid over several runs" },
            { value: "salary_advance", label: "Salary advance, recovered next run" },
          ]}
        />
        {/*
          Not a short loan. This month's own money paid early, and reporting it
          as borrowing would misstate both the receivables and what the person
          owes.
        */}
        <p className={hintCls}>
          {kind === "salary_advance"
            ? "An advance is this month's own pay, early. It comes back in one go."
            : "Spread over instalments, and the last one is whatever is left."}
        </p>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₦)">
          <input
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            min={1}
            required
            className={inputCls}
          />
        </Field>

        {kind === "loan" && (
          <Field label="Over how many runs">
            <input
              type="number"
              value={instalments}
              onChange={(e) => setInstalments(e.target.value)}
              min={1}
              max={120}
              className={inputCls}
            />
          </Field>
        )}
      </div>

      <Field label="Collect from (optional)">
        <input
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label="What for (optional)">
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          maxLength={2000}
          className={inputCls}
        />
      </Field>

      <p className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-600">
        Instalments are collected when a run is approved, and never so far that
        somebody&rsquo;s pay would go below zero.
      </p>

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Actions busy={busy} onClose={onClose} label="Advance" />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Readiness                                                          */
/* ------------------------------------------------------------------ */

/**
 * What has to be cleared before payday.
 *
 * People with no pay profile at all are listed separately and first, because
 * they are invisible on a list of profiles — they simply do not appear, and
 * discovering that on payday is the worst version of this problem.
 */
export function Readiness({
  incomplete,
  withoutProfile,
}: {
  incomplete: { employeeId: string; name: string | null; missing: string[] }[];
  withoutProfile: { employeeId: string; name: string | null; jobTitle: string }[];
}) {
  if (incomplete.length === 0 && withoutProfile.length === 0) {
    return null;
  }

  return (
    <Panel
      title="Before the next run"
      subtitle="None of this is an error until payday, and then it is the only thing that matters."
      icon={AlertTriangle}
      hue="sun"
      bodyClassName="px-5 pb-3 pt-3"
    >
      <ul className="divide-y divide-neutral-100">
        {withoutProfile.map((row) => (
          <li key={row.employeeId} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <PersonCell name={row.name ?? "Unnamed"} sub={row.jobTitle} />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-error-500/10 px-2.5 py-1 text-xs font-semibold text-error-700">
              No salary set
            </span>
          </li>
        ))}

        {incomplete.map((row) => (
          <li key={row.employeeId} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <PersonCell name={row.name ?? "Unnamed"} sub={row.missing.join(", ")} />
            </div>
            <Chip hue="sun" icon={AlertTriangle}>
              {row.missing.length} missing
            </Chip>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function Dialog({
  label,
  onClose,
  onSubmit,
  children,
}: {
  label: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <ModalFrame title={label} icon={ReceiptText} onClose={onClose} onSubmit={onSubmit}>
      {children}
    </ModalFrame>
  );
}

function Actions({
  busy,
  onClose,
  label,
}: {
  busy: boolean;
  onClose: () => void;
  label: string;
}) {
  return (
    <div className="-mx-6 -mb-5 mt-2 flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving…" : label}
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-neutral-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
      />
      {label}
    </label>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <Notice tone="error">{children}</Notice>;
}
