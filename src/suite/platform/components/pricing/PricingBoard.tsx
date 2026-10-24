"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Code2, Info, Layers, RotateCcw, Save } from "lucide-react";
import { Button, CalloutStrip, Chip, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { ErrorNote, inputClass } from "@/suite/lms/components/ui/ws";
import { useAuth } from "@/lib/auth-store";
import {
  ApiError,
  LADDER_RUNGS,
  SELLING_CURRENCIES,
  platformPricing,
  type PlatformPricing,
  type SellingCurrency,
} from "@/lib/api/platform-billing-client";
import { currencySymbol, formatMoney, formatMoneyCompact, parseMajor } from "@/lib/money";
import { canPlatform, PERM } from "@/suite/platform/access";
import { LoadError, Notice, PageSkeleton, useLoad } from "../ui";
import { parseDrafts, perModule, sameDrafts, toDrafts, type PricingDrafts, type PricingProblem } from "./priceInput";

type Rung = (typeof LADDER_RUNGS)[number];

/**
 * The price ladder: what an organisation pays, once, to own one module up to
 * all five, in naira and in dollars, plus the price of the full source code.
 *
 * Modules are sold once and kept for good (the owner's ruling of 26 September
 * 2026). An organisation adding modules later pays the difference between its
 * rung and the new one, so the ladder has to climb: the page refuses a rung
 * cheaper than the one below it, and shows what each module works out at so a
 * discount for buying more is visible at a glance.
 *
 * Source code is sold by request, not checkout; its price here is what the
 * public pricing page quotes and what the team invoices.
 */
export default function PricingBoard() {
  const { user } = useAuth();
  const canEdit = canPlatform(user, PERM.settings);

  const fetchPricing = useCallback(() => platformPricing.get(), []);
  const { data, error, reload, setData } = useLoad(fetchPricing, "Prices didn't load.");

  const [draft, setDraft] = useState<PricingDrafts | null>(null);
  const [problems, setProblems] = useState<PricingProblem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const saved = useMemo(() => (data ? toDrafts(data) : null), [data]);
  const current = draft ?? saved;
  const dirty = Boolean(draft && saved && !sameDrafts(draft, saved));

  // Leaving with unsaved prices asks first; the browser owns the wording.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit(currency: SellingCurrency, field: Rung | "source", value: string) {
    if (!current) return;
    const next: PricingDrafts = {
      ladder: { ...current.ladder, [currency]: { ...current.ladder[currency] } },
      sourceCode: { ...current.sourceCode },
    };
    if (field === "source") next.sourceCode[currency] = value;
    else next.ladder[currency][field] = value;
    setDraft(next);
    setProblems((ps) => ps.filter((p) => !(p.currency === currency && p.field === field)));
    setSaveError(null);
  }

  function discard() {
    setDraft(null);
    setProblems([]);
    setSaveError(null);
  }

  async function save() {
    if (!current) return;
    const parsed = parseDrafts(current);
    if ("problems" in parsed) {
      setProblems(parsed.problems);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const next: PlatformPricing = await platformPricing.save(parsed.pricing);
      setData(() => next);
      setDraft(null);
      setProblems([]);
      setNotice("Prices saved. New checkouts and the public pricing page use them straight away.");
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "The prices weren't saved.");
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <PageHeader
      eyebrow="Commerce"
      title="Pricing"
      subtitle="Set what an organisation pays, once, to own one module up to all five, and the price of the full source code."
    />
  );

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <LoadError message={error} onRetry={reload} />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="space-y-6">
        {header}
        <PageSkeleton stats={0} rows={3} />
      </div>
    );
  }

  const problemAt = (c: SellingCurrency, f: Rung | "source") =>
    problems.find((p) => p.currency === c && p.field === f)?.message ?? null;

  return (
    <div className="space-y-6">
      {header}

      <CalloutStrip icon={Info} hue="sky" title="Modules are bought once and kept for good">
        An organisation that already owns some pays only the difference between its step and the new one, so each step
        must cost at least as much as the step below. Changes apply to new checkouts. Anything already paid for stays as it
        is.
      </CalloutStrip>

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {!canEdit && <p className="text-sm text-neutral-500">Your platform role can see prices but not change them.</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && !saving) void save();
        }}
        aria-label="Price ladder"
        className="space-y-6"
      >
        <Panel
          title="Modules, one-time"
          subtitle="The price to own this many modules in total."
          icon={Layers}
          hue="blue"
          actions={dirty ? <Chip hue="blue">Unsaved</Chip> : undefined}
          bodyClassName="pt-4"
          className={cx("transition-shadow", dirty && "ring-2 ring-primary-200")}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">One-time price by number of modules owned</caption>
              <thead>
                <tr className="bg-primary-50/50 text-left text-xs font-semibold text-neutral-500">
                  <th scope="col" className="px-5 py-3">
                    Owning
                  </th>
                  {SELLING_CURRENCIES.map((c) => (
                    <th key={c} scope="col" className="px-5 py-3">
                      {c === "NGN" ? "Naira (₦)" : "US dollars ($)"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {LADDER_RUNGS.map((n) => (
                  <tr key={n}>
                    <th scope="row" className="whitespace-nowrap px-5 py-4 text-left align-top font-semibold text-neutral-900">
                      <span className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-sm font-bold tabular-nums text-primary-700"
                          aria-hidden
                        >
                          {n}
                        </span>
                        {n} module{n === 1 ? "" : "s"}
                      </span>
                    </th>
                    {SELLING_CURRENCIES.map((c) => (
                      <td key={c} className="px-5 py-3 align-top">
                        <PriceBox
                          label={`${n} module${n === 1 ? "" : "s"}, ${c}`}
                          currency={c}
                          value={current.ladder[c][n]}
                          onChange={(v) => edit(c, n, v)}
                          disabled={!canEdit}
                          problem={problemAt(c, n)}
                          hint={(total) => {
                            const each = perModule(total, n);
                            return each === null ? "Required" : n === 1 ? "Per module" : `${formatMoneyCompact(each, c)} per module`;
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Full source code"
          subtitle="Sold by request and invoiced by the team. The pricing page quotes this price."
          icon={Code2}
          hue="grape"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {SELLING_CURRENCIES.map((c) => (
              <PriceBox
                key={c}
                label={`Source code, ${c}`}
                visibleLabel={c === "NGN" ? "Naira (₦)" : "US dollars ($)"}
                currency={c}
                value={current.sourceCode[c]}
                onChange={(v) => edit(c, "source", v)}
                disabled={!canEdit}
                problem={problemAt(c, "source")}
                hint={(total) => (typeof total === "number" ? formatMoney(total, c) : "Required")}
              />
            ))}
          </div>
        </Panel>

        {problems.length > 0 && (
          <ErrorNote>
            {problems.length === 1 ? "One price needs fixing" : `${problems.length} prices need fixing`} before saving.
          </ErrorNote>
        )}
        {saveError && <ErrorNote>{saveError}</ErrorNote>}

        {canEdit && dirty && (
          <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-2 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-lg shadow-neutral-900/5 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
            <p className="mr-auto hidden text-sm text-neutral-500 sm:block">You have unsaved price changes.</p>
            <Button icon={RotateCcw} onClick={discard} disabled={saving}>
              Discard changes
            </Button>
            <Button type="submit" variant="primary" icon={Save} disabled={saving}>
              {saving ? "Saving…" : "Save prices"}
            </Button>
          </div>
        )}
      </form>

      <p className="text-xs text-neutral-500">
        The technical team quotes dedicated servers and custom domains yearly. Requests arrive in{" "}
        <Link href="/suite/platform/sales-requests" className="font-semibold text-primary-700 hover:underline">
          Sales requests
        </Link>
        .
      </p>
    </div>
  );
}

function PriceBox({
  label,
  visibleLabel,
  currency,
  value,
  onChange,
  disabled,
  problem,
  hint,
}: {
  label: string;
  visibleLabel?: string;
  currency: SellingCurrency;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  problem: string | null;
  hint: (parsed: number | "invalid" | null) => string;
}) {
  const id = useId();
  const parsed = parseMajor(value);
  return (
    <div>
      {visibleLabel ? (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700">
          {visibleLabel}
        </label>
      ) : null}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500" aria-hidden>
          {currencySymbol(currency)}
        </span>
        <input
          id={id}
          aria-label={visibleLabel ? undefined : label}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${id}-hint`}
          className={cx(inputClass, "pl-8 tabular-nums", problem && "border-error-400 focus:border-error-500 focus:ring-error-100")}
        />
      </div>
      <p id={`${id}-hint`} className={cx("mt-1.5 text-xs tabular-nums", problem ? "text-error-700" : "text-neutral-500")}>
        {problem ?? hint(parsed)}
      </p>
    </div>
  );
}
