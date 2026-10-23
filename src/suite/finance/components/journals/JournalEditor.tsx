"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Equal, Send } from "lucide-react";
import { errorText, ledger, type Account, type JournalDetail } from "@/lib/api/finance-ledger-client";
import { Button, Card, PageHeader, Segmented, cx } from "@/components/workspace/kit";
import type { SelectOption } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { accounting, parseAmount } from "@/suite/finance/lib/format";
import { accountOptions } from "../accounts/meta";
import { BalanceMeter } from "./BalanceMeter";
import { blankRow, errorsByRow, isBlank, prepare, rowsFromDetail, totals, type EntryRow } from "./entry";
import { JournalLinesGrid } from "./JournalLinesGrid";
import { hasErrors, journalErrors, type JournalErrors } from "./meta";
import { dayKey } from "../periods/PeriodStrip";

/**
 * Keying a journal: a header (date, what it is for) and a grid of lines -
 * account, a description, a debit or a credit, and the dimensions an
 * account asks for. The beam at the foot says whether it balances before
 * the ledger is asked. Enter on a line's last field starts the next line.
 */

const today = () => dayKey(new Date());

export default function JournalEditor({ journalId }: { journalId?: string }) {
  const router = useRouter();
  const uid = useId();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [draft, setDraft] = useState<JournalDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [date, setDate] = useState(today);
  const [narration, setNarration] = useState("");
  const [type, setType] = useState<"manual" | "opening">("manual");
  const [rows, setRows] = useState<EntryRow[]>(() => [blankRow(), blankRow()]);
  const [errors, setErrors] = useState<JournalErrors>({ lines: {} });
  const [rowErrors, setRowErrors] = useState<ReturnType<typeof errorsByRow>>({});
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([ledger.accounts.list({ postableOnly: true }), journalId ? ledger.journals.get(journalId) : Promise.resolve(null)])
      .then(([a, j]) => {
        if (!alive) return;
        setAccounts(a.accounts);
        setLoadError(null);
        if (j) {
          setDraft(j);
          setDate(j.journalDate);
          setNarration(j.narration);
          setType(j.type === "opening" ? "opening" : "manual");
          setRows(j.lines.length ? [...rowsFromDetail(j), ...(j.lines.length < 2 ? [blankRow()] : [])] : [blankRow(), blankRow()]);
        }
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e) || "The journal didn't load."));
    return () => {
      alive = false;
    };
  }, [journalId, reload]);

  /* Leaving with unsaved lines asks first. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const byId = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const options = useMemo<SelectOption[]>(() => {
    const base = accountOptions(accounts ?? []);
    // A saved line on an account since switched off still needs a label.
    for (const l of draft?.lines ?? [])
      if (!base.some((o) => o.value === l.account.id)) base.unshift({ value: l.account.id, label: `${l.account.code ?? ""} ${l.account.name ?? ""}`.trim(), hint: "Switched off" });
    return base;
  }, [accounts, draft]);

  const sums = useMemo(() => totals(rows, byId), [rows, byId]);
  const currencies = [...sums.keys()];
  const single = currencies.length <= 1;
  const only = sums.get(currencies[0] ?? "") ?? { debits: 0, credits: 0 };

  /* ---------------------------- editing ---------------------------- */

  const touch = () => setDirty(true);
  const patch = (key: string, p: Partial<EntryRow>) => {
    touch();
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  };

  /** Put the difference on the last line that has an account but no amount, else the last line. */
  const balanceTarget = (() => {
    if (!single) return null;
    const diff = only.debits - only.credits;
    if (diff === 0) return null;
    const live = rows.filter((r) => !isBlank(r));
    const target = [...live].reverse().find((r) => r.accountId && !r.debit.trim() && !r.credit.trim()) ?? live[live.length - 1];
    return target ? { key: target.key, line: rows.indexOf(target) + 1, side: diff > 0 ? ("credit" as const) : ("debit" as const), value: Math.abs(diff) } : null;
  })();

  const fillDifference = () => {
    const t = balanceTarget;
    const r = t && rows.find((x) => x.key === t.key);
    if (!t || !r) return;
    // The line as one signed, debit-positive figure, moved by the difference.
    const next = (parseAmount(r.debit) ?? 0) - (parseAmount(r.credit) ?? 0) + (t.side === "debit" ? t.value : -t.value);
    patch(r.key, { debit: next > 0 ? accounting(next) : "", credit: next < 0 ? accounting(-next) : "" });
  };

  /* ---------------------------- saving ----------------------------- */

  const save = async (andSubmit: boolean) => {
    if (!accounts) return;
    const { input, errors: local, sent } = prepare({ date, narration, type }, rows, byId);
    setErrors(local);
    setRowErrors(errorsByRow(local, sent));
    if (!input) return;
    setBusy(andSubmit ? "submit" : "save");
    try {
      const saved = journalId ? await ledger.journals.update(journalId, input) : await ledger.journals.create(input);
      setDirty(false);
      if (andSubmit) {
        try {
          await ledger.journals.submit(saved.id);
        } catch (e) {
          // Saved, but not sent: say so on the journal itself.
          router.push(`/suite/finance/journals/${saved.id}?notice=${encodeURIComponent(`Saved as a draft. It was not sent for approval: ${errorText(e)}`)}`);
          return;
        }
      }
      router.push(`/suite/finance/journals/${saved.id}?notice=${andSubmit ? "submitted" : "saved"}`);
    } catch (e) {
      const mapped = journalErrors(e);
      setErrors(mapped);
      setRowErrors(errorsByRow(mapped, sent));
      setBusy(null);
    }
  };

  /* ---------------------------- render ----------------------------- */

  const title = journalId ? `Edit ${draft?.journalNo ?? "draft journal"}` : "New journal";
  const backHref = journalId ? `/suite/finance/journals/${journalId}` : "/suite/finance/journals";

  if (loadError)
    return (
      <div>
        <BackLink href={backHref} label="Back" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!accounts) return <Skeleton className="h-[28rem]" />;
  if (draft && draft.status !== "draft")
    return (
      <div>
        <BackLink href={backHref} label="Back to the journal" />
        <ErrorNote>Only a draft can be changed. This journal is past that: reverse it and key a new one instead.</ErrorNote>
      </div>
    );

  return (
    <div>
      <BackLink href={backHref} label={journalId ? "Back to the journal" : "All journals"} />
      <PageHeader title={title} subtitle="Every line is a debit or a credit. The journal posts only when both sides agree." />

      {errors.general && <ErrorNote className="mb-4">{errors.general}</ErrorNote>}

      <Card className="mb-5 p-5">
        <div className="grid gap-4 md:grid-cols-[11rem_1fr_auto]">
          <div>
            <label htmlFor={`${uid}-date`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Date
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
              aria-describedby={errors.date ? `${uid}-date-err` : undefined}
              className={cx(inputClass, errors.date && "border-error-500")}
            />
            {errors.date && (
              <p id={`${uid}-date-err`} role="alert" className="mt-1.5 text-xs font-medium text-error-700">
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
              required
              maxLength={500}
              value={narration}
              placeholder="What this journal records, e.g. Accrued electricity for September"
              onChange={(e) => {
                touch();
                setNarration(e.target.value);
              }}
              aria-invalid={Boolean(errors.narration) || undefined}
              aria-describedby={errors.narration ? `${uid}-narr-err` : undefined}
              className={cx(inputClass, errors.narration && "border-error-500")}
            />
            {errors.narration && (
              <p id={`${uid}-narr-err`} role="alert" className="mt-1.5 text-xs font-medium text-error-700">
                {errors.narration}
              </p>
            )}
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-neutral-700">Kind</span>
            {journalId ? (
              <p className="flex h-11 items-center text-sm text-neutral-700">{type === "opening" ? "Opening balances" : "Manual"}</p>
            ) : (
              <div className="flex h-11 items-center">
                <Segmented
                  label="Kind of journal"
                  value={type}
                  onChange={(v) => {
                    touch();
                    setType(v);
                  }}
                  options={[
                    { key: "manual", label: "Manual" },
                    { key: "opening", label: "Opening balances" },
                  ]}
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      <JournalLinesGrid
        rows={rows}
        onChange={(update) => {
          touch();
          setRows(update);
        }}
        accounts={byId}
        options={options}
        rowErrors={rowErrors}
      />

      {/* The foot: totals, the beam, and the actions. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-neutral-200/80 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          {single ? (
            <BalanceMeter debits={only.debits} credits={only.credits} currency={currencies[0] || undefined} />
          ) : (
            <div className="min-w-0 flex-1 text-sm text-neutral-600">
              <p className="font-semibold text-neutral-900">Lines in {currencies.length} currencies</p>
              <p className="mt-0.5 text-xs">
                {currencies.map((c) => `${c || "Base"}: Dr ${accounting(sums.get(c)!.debits)} / Cr ${accounting(sums.get(c)!.credits)}`).join(" · ")}. The ledger converts each line at the rate recorded for the date and checks the balance when you save.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {balanceTarget && (
              <Button size="sm" variant="ghost" icon={Equal} onClick={fillDifference}>
                Put the {accounting(balanceTarget.value)} difference on line {balanceTarget.line}
              </Button>
            )}
            <Button onClick={() => save(false)} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </Button>
            <Button variant="primary" icon={Send} onClick={() => save(true)} disabled={busy !== null}>
              {busy === "submit" ? "Sending…" : "Send for approval"}
            </Button>
          </div>
        </div>
        {(errors.grid || (hasErrors(errors) && Object.keys(errors.lines).length > 0)) && (
          <p role="alert" className="mt-3 text-sm font-medium text-error-700">
            {errors.grid ?? "Some lines need attention. They are marked above."}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Sending for approval saves the journal first. A second person approves it from{" "}
        <Link href="/suite/approvals" className="font-semibold text-primary-700 hover:underline">
          Approvals
        </Link>
        , and it posts when they do.
      </p>
    </div>
  );
}
