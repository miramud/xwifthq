"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Save, Send, Trash2 } from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { ErrorNote, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import { lookupText } from "@/suite/finance/components/banking/lookups";
import { spend, spendError, spendFieldErrors, type MemoFull, type Retirement, type SpendDocument } from "@/lib/api/finance-spend-client";
import { amount as money, amountInput, parseAmount } from "@/suite/finance/lib/format";
import { Money } from "@/suite/finance/components/banking/ui";
import { DocumentList, UploadZone } from "./ui";
import { retirementStatus, retirementSum } from "./labels";

/**
 * Accounting for an advance: what it was spent on, line by line, with the
 * account and the project or cost centre; any cash handed back and into
 * which bank account; and the receipts. Spent plus cash returned must equal
 * the advance - the sum is worked out as you type. Spending more than the
 * advance is a separate claim, not a retirement.
 */

interface Line {
  key: number;
  accountId: string;
  projectId: string;
  costCentreId: string;
  description: string;
  amount: string;
}

let seq = 0;
const blankLine = (projectId: string | null): Line => ({ key: ++seq, accountId: "", projectId: projectId ?? "", costCentreId: "", description: "", amount: "" });

function fromRetirement(r: Retirement, fallbackProject: string | null): Line[] {
  if (r.lines.length === 0) return [blankLine(fallbackProject)];
  return r.lines.map((l) => ({
    key: ++seq,
    accountId: l.account?.id ?? "",
    projectId: l.projectId ?? "",
    costCentreId: l.costCentreId ?? "",
    description: l.description,
    amount: amountInput(l.amount),
  }));
}

export default function RetirementForm({ memo, onChanged }: { memo: MemoFull; onChanged: (r: Retirement) => void }) {
  const existing = memo.retirement;
  const editable = !existing || existing.status === "draft" || existing.status === "fcu_queried";
  const advanced = existing?.advanced ?? memo.paidAmount;

  const [lines, setLines] = useState<Line[]>(() => (existing ? fromRetirement(existing, memo.projectId) : [blankLine(memo.projectId)]));
  const [refund, setRefund] = useState(existing?.refund ? amountInput(existing.refund) : "");
  const [refundBank, setRefundBank] = useState(existing?.refundBankAccountId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "send" | "upload" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [docs, setDocs] = useState<SpendDocument[]>(existing?.documents ?? []);
  const [dirty, setDirty] = useState(!existing);

  // Everybody can retire an advance: the accounts come with the request options, not the chart.
  const [accounts, setAccounts] = useState<{ status: "loading" | "ready" | "error"; options: SelectOption[] }>({ status: "loading", options: [] });
  const [projects, setProjects] = useState<SelectOption[]>([]);
  const [costCentres, setCostCentres] = useState<SelectOption[]>([]);
  const [banks, setBanks] = useState<{ status: "loading" | "ready" | "error"; options: SelectOption[] }>({ status: "loading", options: [] });

  useEffect(() => {
    let alive = true;
    spend.me
      .options()
      .then((o) => {
        if (!alive) return;
        setProjects(o.projects.map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined })));
        setAccounts({ status: "ready", options: (o.accounts ?? []).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })) });
        setBanks({ status: "ready", options: (o.bankAccounts ?? []).map((b) => ({ value: b.id, label: b.name, hint: b.bankName ?? undefined })) });
      })
      .catch(() => {
        if (!alive) return;
        setAccounts({ status: "error", options: [] });
        setBanks({ status: "error", options: [] });
      });
    orgFoundations.lookups
      .costCentres()
      .then((rows) => alive && setCostCentres(rows.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const parsed = lines.map((l) => parseAmount(l.amount));
  const refundMinor = refund.trim() ? parseAmount(refund) : 0;
  const sum = retirementSum(parsed, refundMinor, advanced);

  const change = (key: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setDirty(true);
    setNotice(null);
  };

  const body = () => {
    const local: Record<string, string> = {};
    lines.forEach((l, i) => {
      if (!l.accountId) local[`lines.${i}.accountId`] = "Choose the account it was spent on.";
      if (!l.description.trim()) local[`lines.${i}.description`] = "Say what it was spent on.";
      if (!parsed[i]) local[`lines.${i}.amount`] = "Type the amount spent.";
    });
    if (refundMinor === null) local.refund = "Type the cash returned as a number, or leave it empty.";
    if ((refundMinor ?? 0) > 0 && !refundBank) local.refundBankAccountId = "Say which account the cash was paid back into.";
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return null;
    }
    return {
      lines: lines.map((l, i) => ({
        accountId: l.accountId,
        projectId: l.projectId || null,
        costCentreId: l.costCentreId || null,
        description: l.description.trim(),
        amount: parsed[i]!,
      })),
      refund: refundMinor ?? 0,
      refundBankAccountId: (refundMinor ?? 0) > 0 ? refundBank : null,
    };
  };

  const save = async (): Promise<Retirement | null> => {
    const b = body();
    if (!b) return null;
    setErrors({});
    try {
      const r = await spend.me.saveRetirement(memo.id, b);
      setDirty(false);
      onChanged(r);
      return r;
    } catch (e) {
      const f = spendFieldErrors(e);
      setErrors(Object.keys(f).length ? f : { general: spendError(e) });
      return null;
    }
  };

  const onSave = async () => {
    setBusy("save");
    const r = await save();
    setBusy(null);
    if (r) setNotice("Saved. Attach the receipts, then send it to the FCU.");
  };

  const onSend = async () => {
    setBusy("send");
    try {
      const r = dirty || !existing ? await save() : existing;
      if (!r) return;
      const sent = await spend.me.submitRetirement(r.id);
      onChanged(sent);
      setNotice("Sent to the FCU. You'll see their answer here.");
    } catch (e) {
      setErrors({ general: spendError(e) });
    } finally {
      setBusy(null);
    }
  };

  const onReceipt = async (file: File) => {
    setBusy("upload");
    setErrors((x) => ({ ...x, receipts: "" }));
    try {
      const r = existing && !dirty ? existing : await save();
      if (!r) {
        setErrors((x) => ({ ...x, receipts: "Complete the lines first; the retirement is saved before receipts are attached." }));
        return;
      }
      setDocs(await spend.me.uploadRetirement(r.id, file));
    } catch (e) {
      setErrors((x) => ({ ...x, receipts: spendError(e) }));
    } finally {
      setBusy(null);
    }
  };

  const status = existing ? retirementStatus(existing.status) : null;
  const accountsText = accounts.status === "error" ? "The accounts didn't load. Refresh the page; if it keeps happening, ask Finance." : lookupText(accounts, "accounts");

  return (
    <div className="space-y-6">
      {status && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          <Chip hue={status.hue} dot>
            {status.label}
          </Chip>
          {existing?.status === "fcu_queried" && "The FCU has a question about it: answer it above, correct the lines if you need to, and send it again."}
        </p>
      )}

      {/* The sum, live */}
      <div
        className={cx("rounded-2xl border p-4", sum.balanced ? "border-mint-500/30 bg-mint-50/40" : "border-sun-500/30 bg-sun-50/40")}
        aria-live="polite"
        aria-label="Retirement sum"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm tabular-nums">
          <span>
            <span className="block text-xs text-neutral-500">Spent</span>
            <span className="font-bold text-neutral-900">{money(sum.spent)}</span>
          </span>
          <span aria-hidden className="text-lg text-neutral-400">
            +
          </span>
          <span>
            <span className="block text-xs text-neutral-500">Cash returned</span>
            <span className="font-bold text-neutral-900">{money(sum.refund)}</span>
          </span>
          <span aria-hidden className="text-lg text-neutral-400">
            =
          </span>
          <span>
            <span className="block text-xs text-neutral-500">Accounted for</span>
            <span className="font-bold text-neutral-900">{money(sum.accounted)}</span>
          </span>
          <span className="ml-auto text-right">
            <span className="block text-xs text-neutral-500">Advance</span>
            <span className="font-bold text-neutral-900">{money(advanced)}</span>
          </span>
        </div>
        <div className="ws-hatch mt-3 h-2.5 overflow-hidden rounded-full" aria-hidden>
          <div
            className={cx("h-full rounded-full", sum.gap < 0 ? "bg-rose-500" : sum.balanced ? "bg-mint-500" : "bg-sun-500")}
            style={{ width: `${Math.min(100, advanced > 0 ? (sum.accounted / advanced) * 100 : 0)}%` }}
          />
        </div>
        <p className={cx("mt-2 flex items-center gap-1.5 text-sm font-semibold", sum.balanced ? "text-mint-700" : sum.gap < 0 ? "text-rose-700" : "text-sun-700")}>
          {sum.balanced ? (
            <>
              <CheckCircle2 size={15} aria-hidden /> It balances: every naira of the advance is accounted for.
            </>
          ) : sum.gap > 0 ? (
            `${money(sum.gap)} still to account for: add what was spent, or the cash returned.`
          ) : (
            `${money(-sum.gap)} more than the advance. Spending more is a separate claim; raise a payment request for the difference.`
          )}
        </p>
      </div>

      {/* Lines */}
      <fieldset disabled={!editable || busy !== null} className="space-y-3">
        <legend className="mb-2 text-sm font-semibold text-neutral-900">What it was spent on</legend>
        {lines.map((l, i) => (
          <div key={l.key} className="rounded-2xl border border-neutral-200/80 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Line {i + 1}</p>
              {editable && lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setLines((ls) => ls.filter((x) => x.key !== l.key));
                    setDirty(true);
                  }}
                  className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-semibold text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400"
                  aria-label={`Remove line ${i + 1}`}
                >
                  <Trash2 size={14} aria-hidden /> Remove
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor={`rl-desc-${l.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Description
                </label>
                <input id={`rl-desc-${l.key}`} className={inputClass} value={l.description} onChange={(e) => change(l.key, { description: e.target.value })} placeholder="Hotel, two nights in Abuja" />
                <FieldError message={errors[`lines.${i}.description`]} />
              </div>
              <div>
                <label htmlFor={`rl-acc-${l.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Account
                </label>
                <SearchableSelect
                  id={`rl-acc-${l.key}`}
                  value={l.accountId}
                  onChange={(v) => change(l.key, { accountId: v })}
                  options={accounts.options}
                  placeholder="Choose the expense account"
                  searchPlaceholder="Search accounts"
                  noOptionsText={accountsText}
                  disabled={!editable}
                />
                <FieldError message={errors[`lines.${i}.accountId`]} />
              </div>
              <div>
                <label htmlFor={`rl-amt-${l.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Amount (₦)
                </label>
                <input
                  id={`rl-amt-${l.key}`}
                  inputMode="decimal"
                  className={cx(inputClass, "tabular-nums")}
                  value={l.amount}
                  onChange={(e) => change(l.key, { amount: e.target.value })}
                  onBlur={() => parsed[i] && change(l.key, { amount: amountInput(parsed[i]) })}
                  placeholder="0.00"
                />
                <FieldError message={errors[`lines.${i}.amount`]} />
              </div>
              <div>
                <label htmlFor={`rl-proj-${l.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Project
                </label>
                <SearchableSelect
                  id={`rl-proj-${l.key}`}
                  value={l.projectId}
                  onChange={(v) => change(l.key, { projectId: v })}
                  options={projects}
                  clearable
                  placeholder="No project"
                  searchPlaceholder="Search projects"
                  disabled={!editable}
                />
              </div>
              <div>
                <label htmlFor={`rl-cc-${l.key}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Cost centre
                </label>
                <SearchableSelect
                  id={`rl-cc-${l.key}`}
                  value={l.costCentreId}
                  onChange={(v) => change(l.key, { costCentreId: v })}
                  options={costCentres}
                  clearable
                  placeholder="No cost centre"
                  searchPlaceholder="Search cost centres"
                  disabled={!editable}
                />
              </div>
            </div>
          </div>
        ))}
        {editable && (
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              setLines((ls) => [...ls, blankLine(memo.projectId)]);
              setDirty(true);
            }}
          >
            Add a line
          </Button>
        )}
        {errors.lines && <ErrorNote>{errors.lines}</ErrorNote>}
      </fieldset>

      {/* Cash returned */}
      <fieldset disabled={!editable || busy !== null} className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Cash returned</legend>
        <div>
          <label htmlFor="rt-refund" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Amount paid back (₦)
          </label>
          <input
            id="rt-refund"
            inputMode="decimal"
            className={cx(inputClass, "tabular-nums")}
            value={refund}
            onChange={(e) => {
              setRefund(e.target.value);
              setDirty(true);
            }}
            placeholder="0.00"
          />
          <FieldError message={errors.refund} />
        </div>
        <div>
          <label htmlFor="rt-bank" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Paid back into
          </label>
          <SearchableSelect
            id="rt-bank"
            value={refundBank}
            onChange={(v) => {
              setRefundBank(v);
              setDirty(true);
            }}
            options={banks.options}
            clearable
            disabled={!editable || !(refundMinor && refundMinor > 0)}
            placeholder={refundMinor && refundMinor > 0 ? "Choose the bank account" : "Only when cash was returned"}
            searchPlaceholder="Search bank accounts"
            noOptionsText={banks.status === "error" ? "The organisation's bank accounts didn't load. Ask Finance which account to use." : "Loading bank accounts…"}
          />
          <FieldError message={errors.refundBankAccountId} />
        </div>
      </fieldset>

      {/* Receipts */}
      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-900">Receipts</p>
        <p className="mb-3 text-xs text-neutral-500">One for each line spent. Required before it can be sent.</p>
        <div className="space-y-3">
          <DocumentList documents={docs} empty="No receipts attached yet." />
          {editable && <UploadZone compact label="Attach a receipt" busy={busy === "upload"} onFile={(f) => void onReceipt(f)} />}
          <FieldError message={errors.receipts} />
          {errors.documents && <ErrorNote>{errors.documents}</ErrorNote>}
        </div>
      </div>

      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      {notice && (
        <p role="status" className="rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">
          {notice}
        </p>
      )}

      {editable ? (
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
          <Button icon={Save} onClick={() => void onSave()} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save retirement"}
          </Button>
          <Button variant="primary" icon={Send} onClick={() => void onSend()} disabled={busy !== null || !sum.balanced}>
            {busy === "send" ? "Sending…" : "Send to the FCU"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">
          {existing?.status === "posted" ? (
            <>
              Retired: <Money value={existing.spent} /> spent and <Money value={existing.refund} /> returned, posted to the books.
            </>
          ) : (
            "The FCU is checking it. It can't be changed while they do."
          )}
        </p>
      )}
    </div>
  );
}
