"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Landmark, Plus, Send, Trash2, UserRound } from "lucide-react";
import { errorText, ledger, type Account } from "@/lib/api/finance-ledger-client";
import { banking, type BankAccount } from "@/lib/api/finance-banking-client";
import {
  fieldMessages,
  plainError,
  spend,
  type VoucherDetail,
  type VoucherInput,
  type VoucherLineInput,
  type VoucherMemo,
  type WhtRateOption,
} from "@/lib/api/finance-payments-client";
import { Button, Card, Chip, PageHeader, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { accounting, amount, day, parseAmount } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { budgets, isBudgetExceeded, type BudgetCheck } from "@/lib/api/finance-budgets-client";
import { accountOptions } from "../accounts/meta";
import { BudgetCheckPanel } from "../budgets/BudgetCheckPanel";
import { DimensionSelect } from "../journals/dimensions";
import { COST_CATEGORIES } from "../projects/meta";
import { BANK_SOURCE, KIND_LABEL, bpFromPct, lineFigures, memoRoom, pct, sumFigures, tableRate } from "./meta";
import { Fact, MemoMeter, PvNumber } from "./ui";

/**
 * Preparing a payment voucher from a request the FCU has cleared. The memo's
 * facts sit at the top with what is left on it; below, the coding grid -
 * account, project or cost centre, what it is for, gross, VAT and the WHT
 * class - with WHT and net worked out as you type, exactly as the API will.
 * The meter at the foot says whether the voucher fits in the memo before the
 * API is asked. Payee and bank details come from the master and are not
 * typed here.
 */

interface Row {
  key: string;
  accountId: string;
  description: string;
  gross: string;
  vat: string;
  whtCode: string;
  /** A rate other than the table's, with the reason. */
  override: boolean;
  rate: string;
  reason: string;
  projectId: string;
  costCentreId: string;
  costCategory: string;
  more: boolean;
}

let seq = 0;
const newKey = () => `l${++seq}`;

function blankRow(memo: VoucherMemo | null): Row {
  return {
    key: newKey(),
    accountId: "",
    description: memo?.title ?? "",
    gross: "",
    vat: "",
    whtCode: "none",
    override: false,
    rate: "",
    reason: "",
    projectId: memo?.projectId ?? "",
    costCentreId: memo?.projectId ? "" : (memo?.costCentreId ?? ""),
    costCategory: memo?.costCategory ?? "",
    more: false,
  };
}

function rowsFrom(v: VoucherDetail): Row[] {
  return v.lines.map((l) => ({
    key: newKey(),
    accountId: l.account?.id ?? "",
    description: l.description,
    gross: l.gross ? accounting(l.gross) : "",
    vat: l.vat ? accounting(l.vat) : "",
    whtCode: l.whtCode || "none",
    override: Boolean(l.whtOverrideReason),
    rate: l.whtOverrideReason ? pct(l.whtRateBp).replace("%", "") : "",
    reason: l.whtOverrideReason ?? "",
    projectId: l.projectId ?? "",
    costCentreId: l.costCentreId ?? "",
    costCategory: l.costCategory ?? "",
    more: Boolean(l.whtOverrideReason),
  }));
}

const today = () => new Date().toISOString().slice(0, 10);
type RowErrors = Partial<Record<"accountId" | "description" | "gross" | "vat" | "rate" | "reason", string>>;

export default function VoucherEditor({ memoId, voucherId }: { memoId?: string; voucherId?: string }) {
  const router = useRouter();
  const uid = useId();
  const [memo, setMemo] = useState<VoucherMemo | null>(null);
  const [voucher, setVoucher] = useState<VoucherDetail | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [rates, setRates] = useState<WhtRateOption[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [date, setDate] = useState(today);
  const [narration, setNarration] = useState("");
  const [bankId, setBankId] = useState("");
  const [mode, setMode] = useState<"advance" | "lines">("lines");
  const [rows, setRows] = useState<Row[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [errors, setErrors] = useState<{ general?: string; lines?: string; bank?: string; date?: string }>({});
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [dirty, setDirty] = useState(false);
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = voucherId ? await spend.vouchers.get(voucherId) : null;
        const mId = memoId ?? v?.memos[0]?.id;
        if (!mId) throw new Error("Open this page from a cleared request: it needs the memo the voucher pays.");
        const [m, a, r, b] = await Promise.all([
          spend.memos.get(mId),
          ledger.accounts.list({ postableOnly: true }),
          spend.vouchers.whtRates().catch(() => [] as WhtRateOption[]),
          banking.accounts.list().catch(() => [] as BankAccount[]),
        ]);
        if (!alive) return;
        setMemo(m);
        setVoucher(v);
        setAccounts(a.accounts);
        setRates(r);
        setBanks(b.filter((x) => x.status === "active"));
        setLoadError(null);
        if (v) {
          setDate(v.date);
          setNarration(v.narration ?? "");
          setBankId(v.payingBankAccountId ?? "");
          setRows(v.lines.length ? rowsFrom(v) : [blankRow(m)]);
          setMode("lines");
        } else {
          setNarration(m.title);
          setRows([blankRow(m)]);
          setMode(m.type === "advance" ? "advance" : "lines");
        }
      } catch (e) {
        if (alive) setLoadError(errorText(e) || "The voucher didn't load.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [memoId, voucherId, reload]);

  /* Leaving with unsaved lines asks first. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(`${uid}-${focusNext.current}-account`)?.focus();
    focusNext.current = null;
  }, [rows, uid]);

  const options = useMemo<SelectOption[]>(() => {
    const base = accountOptions(accounts ?? []);
    for (const l of voucher?.lines ?? [])
      if (l.account && !base.some((o) => o.value === l.account!.id)) base.unshift({ value: l.account.id, label: `${l.account.code} ${l.account.name}`, hint: "Switched off" });
    return base;
  }, [accounts, voucher]);

  const payeeKind: "company" | "individual" = memo?.payee?.kind === "staff" ? "individual" : (memo?.payee?.vendorKind ?? "company");
  const whtOptions = useMemo<SelectOption[]>(() => {
    const seen = new Map<string, SelectOption>();
    for (const r of rates) if (r.payeeKind === payeeKind) seen.set(r.code, { value: r.code, label: r.label, hint: r.code === "none" ? undefined : pct(r.rateBp) });
    if (!seen.has("none")) seen.set("none", { value: "none", label: "No withholding" });
    return [...seen.values()];
  }, [rates, payeeKind]);

  const currency = (memo?.currency ?? voucher?.currency ?? "NGN") as CurrencyCode;
  const room = memo ? memoRoom(memo, voucherId) : 0;

  const figures = rows.map((r) => {
    const table = tableRate(rates, r.whtCode, payeeKind) ?? 0;
    const own = r.override ? bpFromPct(r.rate) : null;
    return { row: r, table, ...lineFigures(parseAmount(r.gross) ?? 0, parseAmount(r.vat) ?? 0, own ?? table) };
  });
  const advance = mode === "advance" && !voucherId;
  const totals = advance ? { gross: memo?.balance ?? 0, vat: 0, wht: 0, net: memo?.balance ?? 0, draw: memo?.balance ?? 0 } : sumFigures(figures);
  const bank = banks.find((b) => b.id === bankId) ?? null;

  // The company budget check as the lines are typed: what sending would say. Quiet when it can't be asked.
  const checkKey = advance
    ? ""
    : JSON.stringify(figures.filter((f) => f.row.accountId && f.gross > 0).map((f) => [f.row.accountId, f.row.projectId || null, f.row.costCentreId || null, f.gross]));
  const [liveCheck, setLiveCheck] = useState<BudgetCheck | null>(null);
  useEffect(() => {
    let alive = true;
    const lines = (checkKey ? JSON.parse(checkKey) : []) as [string, string | null, string | null, number][];
    const t = setTimeout(() => {
      if (lines.length === 0) {
        if (alive) setLiveCheck(null);
        return;
      }
      budgets.check(lines.map(([accountId, projectId, costCentreId, amount]) => ({ accountId, projectId, costCentreId, amount })), date || undefined).then(
        (r) => alive && setLiveCheck(r && Array.isArray(r.lines) && r.lines.length > 0 ? r : null),
        () => alive && setLiveCheck(null),
      );
    }, 600);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [checkKey, date]);

  /* ---------------------------- editing ---------------------------- */

  const touch = () => setDirty(true);
  const patch = (key: string, p: Partial<Row>) => {
    touch();
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  };
  const addRow = (after?: string) => {
    touch();
    const row = blankRow(memo);
    row.description = "";
    focusNext.current = row.key;
    setRows((rs) => {
      const i = after ? rs.findIndex((r) => r.key === after) : rs.length - 1;
      return [...rs.slice(0, i + 1), row, ...rs.slice(i + 1)];
    });
  };
  const removeRow = (key: string) => {
    touch();
    setRows((rs) => (rs.length <= 1 ? [blankRow(memo)] : rs.filter((r) => r.key !== key)));
  };
  const tidy = (key: string, field: "gross" | "vat", text: string) => {
    const v = parseAmount(text);
    if (v !== null) patch(key, { [field]: v === 0 ? "" : accounting(v) });
  };
  const onLineKey = (e: React.KeyboardEvent, key: string) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const i = rows.findIndex((r) => r.key === key);
    if (i === rows.length - 1) addRow(key);
    else document.getElementById(`${uid}-${rows[i + 1]?.key}-account`)?.focus();
  };

  /* ---------------------------- saving ----------------------------- */

  const prepare = (): VoucherInput | null => {
    const errs: Record<string, RowErrors> = {};
    const lines: VoucherLineInput[] = [];
    if (!advance) {
      figures.forEach(({ row: r, table, gross, vat, rateBp }) => {
        const e: RowErrors = {};
        if (!r.accountId) e.accountId = "Choose the account this line is charged to.";
        if (!r.description.trim()) e.description = "Say what this line pays for.";
        if (parseAmount(r.gross) === null || gross <= 0) e.gross = "Enter an amount above zero.";
        if (r.vat.trim() && parseAmount(r.vat) === null) e.vat = "VAT is an amount, like 7,500.00.";
        if (r.override) {
          if (bpFromPct(r.rate) === null) e.rate = "Enter a rate from 0 to 100, like 5 or 7.5.";
          if (!r.reason.trim()) e.reason = "Changing the table rate needs a reason.";
        }
        if (Object.keys(e).length) errs[r.key] = e;
        lines.push({
          accountId: r.accountId,
          projectId: r.projectId || null,
          costCentreId: r.costCentreId || null,
          costCategory: r.costCategory || null,
          description: r.description.trim(),
          gross,
          vat,
          whtCode: r.whtCode || "none",
          ...(r.override && rateBp !== table ? { whtRateBp: rateBp, whtOverrideReason: r.reason.trim() } : {}),
        });
      });
    }
    setRowErrors(errs);
    const general: typeof errors = {};
    if (!date) general.date = "Choose the voucher date.";
    setErrors(general);
    if (Object.keys(errs).length || general.date) return null;
    return { date, narration: narration.trim() || null, payingBankAccountId: bankId || null, ...(advance ? {} : { lines }) };
  };

  /** Validation from the API, put back on the line or field it is about. */
  const placeErrors = (e: unknown) => {
    const f = fieldMessages(e);
    const per: Record<string, RowErrors> = {};
    const map: Record<string, keyof RowErrors> = { accountId: "accountId", description: "description", gross: "gross", vat: "vat", whtRateBp: "rate", whtOverrideReason: "reason", whtCode: "rate" };
    let placed = false;
    for (const [k, msg] of Object.entries(f)) {
      const m = /^lines\.(\d+)\.(\w+)$/.exec(k);
      const row = m ? rows[Number(m[1])] : undefined;
      if (m && row && map[m[2]]) {
        per[row.key] = { ...per[row.key], [map[m[2]]]: msg };
        placed = true;
      }
    }
    setRowErrors(per);
    setErrors({
      lines: f.lines,
      bank: f.payingBankAccountId,
      date: f.date,
      general: f.lines || f.payingBankAccountId || f.date || placed ? (f.duties ?? f.memo ?? f.payee ?? f.pv) : plainError(e, "The voucher wasn't saved."),
    });
  };

  const save = async (andSubmit: boolean) => {
    if (!memo) return;
    const input = prepare();
    if (!input) return;
    setBusy(andSubmit ? "submit" : "save");
    try {
      const saved = voucherId ? await spend.vouchers.update(voucherId, input) : await spend.vouchers.create(memo.id, input);
      setDirty(false);
      if (andSubmit) {
        try {
          await spend.vouchers.submit(saved.id);
        } catch (e) {
          const raw = errorText(e);
          router.push(
            isBudgetExceeded(raw)
              ? `/suite/finance/vouchers/${saved.id}?notice=${encodeURIComponent("Saved as a draft, not sent to the FCU.")}&refusal=${encodeURIComponent(raw)}`
              : `/suite/finance/vouchers/${saved.id}?notice=${encodeURIComponent(`Saved as a draft, not sent to the FCU: ${plainError(e)}`)}`,
          );
          return;
        }
      }
      router.push(`/suite/finance/vouchers/${saved.id}?notice=${andSubmit ? "submitted" : "saved"}`);
    } catch (e) {
      placeErrors(e);
      setBusy(null);
    }
  };

  /* ---------------------------- render ----------------------------- */

  const backHref = voucherId ? `/suite/finance/vouchers/${voucherId}` : memo ? `/suite/finance/memos/${memo.id}` : "/suite/finance/vouchers";
  const backLabel = voucherId ? "Back to the voucher" : "Back to the request";

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/finance/vouchers" label="All vouchers" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!memo || !accounts) return <Skeleton className="h-[30rem]" />;
  if (voucher && !["draft", "fcu_queried"].includes(voucher.status))
    return (
      <div>
        <BackLink href={backHref} label={backLabel} />
        <ErrorNote>Only a draft or a voucher the FCU queried can be changed. This one is past that: cancel it and prepare a new one instead.</ErrorNote>
      </div>
    );
  if (!voucher && !["fcu_cleared", "partially_paid"].includes(memo.status))
    return (
      <div>
        <BackLink href={backHref} label={backLabel} />
        <ErrorNote>
          A voucher is prepared from a request the FCU has cleared. {memo.reference} isn&apos;t cleared yet, so it can&apos;t be paid. Open it to see where it is.
        </ErrorNote>
      </div>
    );

  return (
    <div>
      <BackLink href={backHref} label={backLabel} />
      <PageHeader
        eyebrow="Payment voucher"
        title={voucher ? <>Edit <PvNumber value={voucher.pvNo} size="lg" className="align-middle" /></> : "Prepare a voucher"}
        subtitle="Code the payment, check the tax, and send it to the FCU. The number is given when it is first saved and never reused."
      />

      {errors.general && <ErrorNote className="mb-4">{errors.general}</ErrorNote>}

      {/* The memo it pays, and the payee from the master. */}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Paying request</p>
              <Link href={`/suite/finance/memos/${memo.id}`} className="mt-1 block truncate text-[15px] font-semibold text-neutral-900 hover:text-primary-700 hover:underline">
                <span className="font-mono text-[13px] text-neutral-500">{memo.reference}</span> · {memo.title}
              </Link>
            </div>
            <Chip hue={memo.type === "advance" ? "grape" : "sky"}>{KIND_LABEL[memo.type] ?? "System"}</Chip>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label="Approved">{amount(memo.approvedAmount ?? memo.amount, currency)}</Fact>
            <Fact label="Paid so far">{amount(memo.paidAmount, currency)}</Fact>
            <Fact label="Left for this voucher">
              <span className="text-primary-700">{amount(room, currency)}</span>
            </Fact>
            <Fact label={memo.project ? "Project" : "Cost centre"}>{memo.project ?? memo.costCentre ?? "-"}</Fact>
          </dl>
          {(memo.vouchers ?? []).filter((v) => v.id !== voucherId).length > 0 && (
            <p className="mt-3 text-xs text-neutral-500">
              Other vouchers on this request:{" "}
              {(memo.vouchers ?? [])
                .filter((v) => v.id !== voucherId)
                .map((v) => `${v.pvNo} (${amount(v.amount, currency)})`)
                .join(", ")}
              .
            </p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Payee</p>
          <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
            <UserRound size={16} className="text-neutral-400" aria-hidden />
            {voucher?.payee ?? memo.payee?.name ?? "-"}
            <Chip hue={memo.payee?.kind === "staff" ? "grape" : "sky"}>{memo.payee?.kind === "staff" ? "Staff" : "Vendor"}</Chip>
          </p>
          {voucher?.payeeBank ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-neutral-700">
              <Landmark size={16} className="mt-0.5 text-neutral-400" aria-hidden />
              <span>
                {voucher.payeeBank.accountName} · {voucher.payeeBank.bankName} ·{" "}
                <span className="font-mono tabular-nums">•••• {voucher.payeeBank.last4}</span>
                <span className="block text-xs text-neutral-500">{BANK_SOURCE[voucher.payeeBank.source ?? ""] ?? "From the master record"}. Not editable here.</span>
              </span>
            </p>
          ) : (
            <p className="mt-3 text-xs text-neutral-500">
              {voucher
                ? "No bank account on record for this payee. Vendors: add and approve one in the vendor register. Staff: HR records the salary account. The voucher can be saved, but not sent, until then."
                : memo.payee?.kind === "staff"
                  ? "Bank details come from HR's salary account when the voucher is saved. They are never typed here."
                  : "Bank details come from the vendor register when the voucher is saved. They are never typed here."}
            </p>
          )}
        </Card>
      </div>

      {/* Header: date, narration, paying account. */}
      <Card className="mb-5 p-5">
        <div className="grid gap-4 md:grid-cols-[11rem_1fr_1fr]">
          <div>
            <label htmlFor={`${uid}-date`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Voucher date
            </label>
            <input
              id={`${uid}-date`}
              type="date"
              required
              value={date}
              onChange={(e) => {
                touch();
                setDate(e.target.value);
              }}
              aria-invalid={Boolean(errors.date) || undefined}
              className={cx(inputClass, errors.date && "border-error-500")}
            />
            {errors.date && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-error-700">
                {errors.date}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${uid}-narr`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Narration
            </label>
            <input
              id={`${uid}-narr`}
              maxLength={2000}
              value={narration}
              placeholder="What the payment is for, as the bank narration will read"
              onChange={(e) => {
                touch();
                setNarration(e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-bank`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Paid from
            </label>
            <SearchableSelect
              id={`${uid}-bank`}
              value={bankId}
              onChange={(v) => {
                touch();
                setBankId(v);
              }}
              clearable
              clearLabel="Choose later"
              options={banks
                .filter((b) => b.currency === currency)
                .map((b) => ({ value: b.id, label: b.name, hint: `Book balance ${amount(b.bookBalance, b.currency as CurrencyCode)}` }))}
              placeholder="Choose the paying account"
              searchPlaceholder="Search bank accounts"
              noOptionsText={`No active ${currency} bank accounts.`}
              aria-invalid={Boolean(errors.bank) || undefined}
            />
            {errors.bank ? (
              <p role="alert" className="mt-1.5 text-xs font-medium text-error-700">
                {errors.bank}
              </p>
            ) : bank ? (
              <p className={cx("mt-1.5 text-xs", bank.bookBalance < totals.net ? "font-semibold text-sun-700" : "text-neutral-500")}>
                Book balance {amount(bank.bookBalance, currency)}
                {bank.bookBalance < totals.net && ": below this voucher's net payable."}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-neutral-500">Needed before it goes to the FCU.</p>
            )}
          </div>
        </div>
      </Card>

      {memo.type === "advance" && !voucherId && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented
            label="How the advance is coded"
            value={mode}
            onChange={(v) => {
              touch();
              setMode(v);
            }}
            options={[
              { key: "advance", label: "One line to staff advances" },
              { key: "lines", label: "Code the lines" },
            ]}
          />
          <span className="text-xs text-neutral-500">An advance normally goes to staff advances in full, and is retired against receipts later.</span>
        </div>
      )}

      {advance ? (
        <Card className="p-5">
          <p className="text-sm text-neutral-700">
            One line, <span className="font-semibold">Staff advances</span>, for the memo&apos;s balance of{" "}
            <span className="font-semibold tabular-nums">{amount(memo.balance, currency)}</span>. No VAT or withholding on an advance.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <caption className="sr-only">Voucher lines</caption>
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="w-10 py-3 pl-4 pr-2 text-right">
                    #
                  </th>
                  <th scope="col" className="w-[24%] px-2 py-3">
                    Account
                  </th>
                  <th scope="col" className="px-2 py-3">
                    Description
                  </th>
                  <th scope="col" className="w-32 px-2 py-3 text-right">
                    Gross
                  </th>
                  <th scope="col" className="w-28 px-2 py-3 text-right">
                    VAT
                  </th>
                  <th scope="col" className="w-44 px-2 py-3">
                    WHT class
                  </th>
                  <th scope="col" className="w-28 px-2 py-3 text-right">
                    WHT
                  </th>
                  <th scope="col" className="w-32 px-2 py-3 text-right">
                    Net
                  </th>
                  <th scope="col" className="w-24 py-3 pl-2 pr-4">
                    <span className="sr-only">Line actions</span>
                  </th>
                </tr>
              </thead>
              {figures.map((f, i) => (
                <LineRows
                  key={f.row.key}
                  uid={uid}
                  n={i + 1}
                  row={f.row}
                  table={f.table}
                  wht={f.wht}
                  net={f.net}
                  rateBp={f.rateBp}
                  options={options}
                  whtOptions={whtOptions}
                  errors={rowErrors[f.row.key] ?? {}}
                  onPatch={(p) => patch(f.row.key, p)}
                  onTidy={(field, t) => tidy(f.row.key, field, t)}
                  onKey={(e) => onLineKey(e, f.row.key)}
                  onRemove={() => removeRow(f.row.key)}
                />
              ))}
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 px-4 py-3">
            <Button size="sm" icon={Plus} onClick={() => addRow()}>
              Add a line
            </Button>
            <span className="text-xs text-neutral-500">
              Press Enter in a line to start the next one. WHT is worked out on the amount before VAT, at the {payeeKind === "individual" ? "individual" : "company"} rate.
            </span>
          </div>
        </Card>
      )}

      {liveCheck && <BudgetCheckPanel check={liveCheck} context="live" currency={currency} className="mt-5" />}

      {/* The foot: the memo meter, the totals, and the actions. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-neutral-200/80 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <MemoMeter room={room} draw={totals.draw} currency={currency} />
          <dl className="grid grid-cols-4 gap-3 text-right xl:w-[26rem]">
            {(
              [
                ["Gross", totals.gross],
                ["VAT", totals.vat],
                ["WHT", totals.wht],
                ["Net payable", totals.net],
              ] as const
            ).map(([label, v]) => (
              <div key={label}>
                <dt className="text-[11px] font-medium text-neutral-500">{label}</dt>
                <dd className={cx("mt-0.5 text-sm tabular-nums", label === "Net payable" ? "font-bold text-neutral-900" : "font-semibold text-neutral-700")}>
                  {label === "WHT" && v ? `−${accounting(v)}` : accounting(v)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button onClick={() => save(false)} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </Button>
            <Button variant="primary" icon={Send} onClick={() => save(true)} disabled={busy !== null}>
              {busy === "submit" ? "Sending…" : "Send to FCU"}
            </Button>
          </div>
        </div>
        {(errors.lines || Object.keys(rowErrors).length > 0) && (
          <p role="alert" className="mt-3 text-sm font-medium text-error-700">
            {errors.lines ?? "Some lines need attention. They are marked above."}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        {voucher ? (
          <>
            Dated {day(voucher.date)}. Sending saves the voucher first; the FCU checks it against the request before it is authorised.
          </>
        ) : (
          "Saving gives the voucher its number. Sending saves it first; the FCU checks it against the request before it is authorised."
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LineRows({
  uid,
  n,
  row: r,
  table,
  wht,
  net,
  rateBp,
  options,
  whtOptions,
  errors,
  onPatch,
  onTidy,
  onKey,
  onRemove,
}: {
  uid: string;
  n: number;
  row: Row;
  table: number;
  wht: number;
  net: number;
  rateBp: number;
  options: SelectOption[];
  whtOptions: SelectOption[];
  errors: RowErrors;
  onPatch: (p: Partial<Row>) => void;
  onTidy: (field: "gross" | "vat", text: string) => void;
  onKey: (e: React.KeyboardEvent) => void;
  onRemove: () => void;
}) {
  const id = (f: string) => `${uid}-${r.key}-${f}`;
  const showDetail = r.more || Boolean(errors.rate || errors.reason);
  const field =
    "h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-primary-400 focus:ring-4 focus:ring-primary-100";
  const err = (f: keyof RowErrors) =>
    errors[f] ? (
      <p id={id(`${f}-err`)} role="alert" className="mt-1 text-xs font-medium text-error-700">
        {errors[f]}
      </p>
    ) : null;
  const overridden = r.override && rateBp !== table;

  return (
    <tbody className="border-b border-neutral-100 last:border-b-0">
      <tr className="align-top">
        <td className="py-2.5 pl-4 pr-2 pt-[1.15rem] text-right text-xs font-semibold tabular-nums text-neutral-400">{n}</td>
        <td className="px-2 py-2.5">
          <SearchableSelect
            id={id("account")}
            size="sm"
            value={r.accountId}
            onChange={(v) => onPatch({ accountId: v })}
            options={options}
            placeholder="Choose an account"
            searchPlaceholder="Search code or name"
            aria-label={`Account, line ${n}`}
            aria-invalid={Boolean(errors.accountId) || undefined}
            aria-describedby={errors.accountId ? id("accountId-err") : undefined}
          />
          {err("accountId")}
        </td>
        <td className="px-2 py-2.5">
          <input
            id={id("description")}
            value={r.description}
            maxLength={255}
            onChange={(e) => onPatch({ description: e.target.value })}
            onKeyDown={onKey}
            placeholder="What this line pays for"
            aria-label={`Description, line ${n}`}
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={errors.description ? id("description-err") : undefined}
            className={cx(field, errors.description && "border-error-500")}
          />
          {err("description")}
        </td>
        {(["gross", "vat"] as const).map((f) => (
          <td key={f} className="px-2 py-2.5">
            <input
              id={id(f)}
              inputMode="decimal"
              autoComplete="off"
              value={r[f]}
              onChange={(e) => onPatch({ [f]: e.target.value })}
              onBlur={(e) => onTidy(f, e.target.value)}
              onKeyDown={onKey}
              placeholder="0.00"
              aria-label={`${f === "gross" ? "Gross, before VAT" : "VAT"}, line ${n}`}
              aria-invalid={Boolean(errors[f]) || undefined}
              aria-describedby={errors[f] ? id(`${f}-err`) : undefined}
              className={cx(field, "text-right tabular-nums", errors[f] && "border-error-500")}
            />
            {err(f)}
          </td>
        ))}
        <td className="px-2 py-2.5">
          <SearchableSelect
            id={id("wht")}
            size="sm"
            value={r.whtCode}
            onChange={(v) => onPatch({ whtCode: v || "none" })}
            options={whtOptions}
            searchPlaceholder="Search WHT classes"
            aria-label={`WHT class, line ${n}`}
          />
        </td>
        <td className="px-2 py-2.5 pt-[1.05rem] text-right">
          <span className="block tabular-nums text-neutral-900">{wht ? accounting(wht) : "-"}</span>
          <span className={cx("block text-[11px]", overridden ? "font-semibold text-sun-700" : "text-neutral-500")}>
            {pct(rateBp)}
            {overridden && " · changed"}
          </span>
        </td>
        <td className="px-2 py-2.5 pt-[1.05rem] text-right font-semibold tabular-nums text-neutral-900">{net ? accounting(net) : "-"}</td>
        <td className="py-2.5 pl-2 pr-4">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => onPatch({ more: !r.more })}
              aria-expanded={showDetail}
              aria-controls={id("detail")}
              aria-label={`${showDetail ? "Hide" : "Show"} project, category and rate, line ${n}`}
              title="Project, cost centre, category, WHT rate"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              {showDetail ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove line ${n}`}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        </td>
      </tr>
      {showDetail && (
        <tr id={id("detail")}>
          <td />
          <td colSpan={8} className="px-2 pb-3">
            <div className="grid gap-3 rounded-xl bg-neutral-50 p-3 sm:grid-cols-2 xl:grid-cols-5">
              <div>
                <label htmlFor={id("projectId")} className="mb-1 block text-xs font-medium text-neutral-600">
                  Project
                </label>
                <DimensionSelect kind="projectId" id={id("projectId")} size="sm" value={r.projectId} onChange={(v) => onPatch({ projectId: v })} />
              </div>
              <div>
                <label htmlFor={id("costCentreId")} className="mb-1 block text-xs font-medium text-neutral-600">
                  Cost centre
                </label>
                <DimensionSelect kind="costCentreId" id={id("costCentreId")} size="sm" value={r.costCentreId} onChange={(v) => onPatch({ costCentreId: v })} />
              </div>
              <div>
                <label htmlFor={id("cat")} className="mb-1 block text-xs font-medium text-neutral-600">
                  Budget category
                </label>
                <SearchableSelect
                  id={id("cat")}
                  size="sm"
                  value={r.costCategory}
                  onChange={(v) => onPatch({ costCategory: v })}
                  clearable
                  clearLabel="The request's category"
                  options={Object.entries(COST_CATEGORIES).map(([value, label]) => ({ value, label }))}
                  searchPlaceholder="Search categories"
                />
              </div>
              <div>
                <span className="mb-1 flex items-center justify-between text-xs font-medium text-neutral-600">
                  <label htmlFor={id("rate")}>WHT rate (%)</label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={r.override}
                      onChange={(e) => onPatch({ override: e.target.checked, rate: e.target.checked ? pct(table).replace("%", "") : "", reason: e.target.checked ? r.reason : "" })}
                      className="h-4 w-4 accent-primary-600"
                    />
                    Change the rate
                  </label>
                </span>
                <input
                  id={id("rate")}
                  inputMode="decimal"
                  disabled={!r.override}
                  value={r.override ? r.rate : pct(table).replace("%", "")}
                  onChange={(e) => onPatch({ rate: e.target.value })}
                  aria-invalid={Boolean(errors.rate) || undefined}
                  aria-describedby={errors.rate ? id("rate-err") : undefined}
                  className={cx(field, "h-9 text-right tabular-nums disabled:bg-neutral-100 disabled:text-neutral-500", errors.rate && "border-error-500")}
                />
                {err("rate")}
              </div>
              <div>
                <label htmlFor={id("reason")} className="mb-1 block text-xs font-medium text-neutral-600">
                  Why the rate changes{r.override && <span className="text-error-700"> *</span>}
                </label>
                <input
                  id={id("reason")}
                  disabled={!r.override}
                  maxLength={255}
                  value={r.reason}
                  onChange={(e) => onPatch({ reason: e.target.value })}
                  placeholder={r.override ? "e.g. Exemption certificate on file" : "Table rate applies"}
                  aria-invalid={Boolean(errors.reason) || undefined}
                  aria-describedby={errors.reason ? id("reason-err") : undefined}
                  className={cx(field, "h-9 disabled:bg-neutral-100", errors.reason && "border-error-500")}
                />
                {err("reason")}
              </div>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}
