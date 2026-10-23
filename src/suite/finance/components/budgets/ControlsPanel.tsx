"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Button, Chip, Empty, Panel, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote } from "@/suite/lms/components/ui/ws";
import { familyMeta, familyOf } from "@/suite/finance/components/accounts/meta";
import { ledger } from "@/lib/api/finance-ledger-client";
import { PROFIT_AND_LOSS, budgets, errorText, type BudgetControl, type ControlMode } from "@/lib/api/finance-budgets-client";
import { CONTROL_MODE } from "./meta";

/**
 * The budget controls: which accounts a voucher may not take over budget.
 * WARN flags it, BLOCK refuses it. A control on a heading covers every
 * account under it.
 */

type Mode = ControlMode | "off";
const MODES: { key: Mode; label: string }[] = [
  { key: "warn", label: "Warn" },
  { key: "block", label: "Block" },
  { key: "off", label: "Off" },
];

export function ControlsPanel({ controls, canSet, onChanged }: { controls: BudgetControl[]; canSet: boolean; onChanged: (message: string) => void }) {
  const uid = useId();
  const confirm = useConfirm();
  const [options, setOptions] = useState<SelectOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [mode, setMode] = useState<ControlMode>("warn");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canSet) return;
    let alive = true;
    ledger.accounts.list().then(
      (r) => {
        if (!alive) return;
        setOptions(
          r.accounts
            .filter((a) => a.active && PROFIT_AND_LOSS.includes(a.type))
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
            .map((a) => ({ value: a.id, label: `${a.code} ${a.name}`, hint: a.isPostable ? undefined : "Heading: covers the accounts under it", group: familyMeta(familyOf(a.type)).label })),
        );
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [canSet]);

  const taken = useMemo(() => new Set(controls.map((c) => c.accountId)), [controls]);
  const free = useMemo(() => (options ?? []).filter((o) => !taken.has(o.value)), [options, taken]);

  const set = async (id: string, name: string, next: Mode) => {
    if (next === "off") {
      const ok = await confirm({
        title: `Take the control off ${name}?`,
        body: "Vouchers on this account are no longer checked against the budget. You can put a control back at any time.",
        confirmLabel: "Take control off",
      });
      if (!ok) return;
    } else if (next === "block") {
      const ok = await confirm({
        title: `Block ${name} over budget?`,
        body: "From now on a voucher that would take this account over its budget for the year is refused until the budget is revised or the line is recoded.",
        confirmLabel: "Block over budget",
        tone: "primary",
      });
      if (!ok) return;
    }
    setBusy(id);
    setError(null);
    try {
      await budgets.setControl(id, next);
      onChanged(next === "off" ? `${name} is no longer checked against the budget.` : `${name}: ${CONTROL_MODE[next].label.toLowerCase()} when a voucher goes over budget.`);
      if (id === accountId) setAccountId("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const adding = options?.find((o) => o.value === accountId);

  return (
    <Panel title="Controls" subtitle="What happens when a voucher would take an account over its budget for the year" icon={ShieldCheck} hue="rose">
      {controls.length === 0 ? (
        <Empty icon={ShieldCheck} hue="rose" title="No account is controlled" hint="Vouchers are not checked against the budget until an account has a warn or block control." />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {controls.map((c) => {
            const m = CONTROL_MODE[c.mode];
            const name = `${c.code ?? ""} ${c.name ?? "Account"}`.trim();
            return (
              <li key={c.accountId} className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    <span className="font-mono text-[13px] text-neutral-500">{c.code}</span> {c.name}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">{m.says}</p>
                </div>
                {canSet ? (
                  <div className={cx(busy === c.accountId && "pointer-events-none opacity-60")}>
                    <Segmented<Mode> label={`Control on ${name}`} options={MODES} value={c.mode} onChange={(v) => v !== c.mode && set(c.accountId, name, v)} />
                  </div>
                ) : (
                  <Chip hue={m.hue} icon={m.icon}>
                    {m.label}
                  </Chip>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canSet && (
        <form
          className="mt-4 rounded-2xl bg-neutral-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (accountId) set(accountId, adding?.label ?? "the account", mode);
          }}
        >
          <label htmlFor={`${uid}-acc`} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Control another account
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchableSelect
              id={`${uid}-acc`}
              value={accountId}
              onChange={setAccountId}
              options={free}
              placeholder={options ? "Choose an income or expense account" : failed ? "Accounts didn't load" : "Loading accounts…"}
              searchPlaceholder="Search by code or name"
              noOptionsText={failed ? "The chart of accounts didn't load. Reload the page to try again." : "Loading accounts…"}
              className="min-w-0 flex-1"
            />
            <Segmented<ControlMode> label="Mode for the new control" options={MODES.filter((m): m is { key: ControlMode; label: string } => m.key !== "off")} value={mode} onChange={setMode} />
            <Button type="submit" icon={Plus} disabled={!accountId || busy !== null}>
              Add control
            </Button>
          </div>
        </form>
      )}
      {error && <ErrorNote className="mt-3">{error}</ErrorNote>}
    </Panel>
  );
}
