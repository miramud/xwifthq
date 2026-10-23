"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import { orgFoundations, type FxRate } from "@/lib/api/org-foundations-client";
import { Button, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { MultiLine, Sparkline } from "@/components/workspace/charts";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { dateLabel, isRateText, ratesByCurrency, todayIso } from "./logic";
import { CurrencySelect, FieldError, LoadError, errorText, fieldErrors } from "./shared";

/**
 * Exchange rates: one unit of a foreign currency in the base currency, on a
 * date. Postings in a foreign currency use the latest rate on or before their
 * date. Rates are typed and sent as decimal text, never as floats, so
 * 1545.25 stays 1545.25.
 */

const fmt = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 4 });

export default function FxRatesPanel({ baseCurrency: profileBase }: { baseCurrency: string | null }) {
  const confirm = useConfirm();
  const [rates, setRates] = useState<FxRate[] | null>(null);
  const [base, setBase] = useState<string | null>(profileBase);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const [currency, setCurrency] = useState("");
  const [rate, setRate] = useState("");
  const [asOf, setAsOf] = useState(todayIso());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    orgFoundations.fxRates
      .list()
      .then((r) => {
        if (!alive) return;
        setRates(r.data);
        setBase(r.meta.baseCurrency);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e, "Exchange rates didn't load.")));
    return () => {
      alive = false;
    };
  }, [reload]);

  const groups = useMemo(() => ratesByCurrency(rates ?? []), [rates]);
  const active = groups.find((g) => g.currency === selected) ?? groups[0] ?? null;
  const baseCode = base ?? profileBase ?? "base";

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!/^[A-Za-z]{3}$/.test(currency)) found.currency = "Choose a currency.";
    else if (currency.toUpperCase() === base) found.currency = `${base} is the base currency; it has no rate against itself.`;
    if (!isRateText(rate)) found.rate = "Type a rate above zero, like 1545.25 (up to 8 decimals).";
    if (asOf && asOf > todayIso()) found.asOf = "Rates can't be dated in the future.";
    setErrors(found);
    setError(null);
    setNotice(null);
    if (Object.keys(found).length > 0) return;
    setAdding(true);
    try {
      const made = await orgFoundations.fxRates.create({ currency: currency.toUpperCase(), rate: rate.trim(), asOf: asOf || undefined });
      setRates((r) => [...(r ?? []).filter((x) => x.id !== made.id), made]);
      setSelected(made.currency);
      setRate("");
      setNotice(`${made.currency} rate for ${dateLabel(made.asOf)} added.`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err, "The rate wasn't added."));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (r: FxRate) => {
    const ok = await confirm({
      title: `Remove the ${r.currency} rate of ${dateLabel(r.asOf)}?`,
      body: "Postings already made keep the rate they used. New postings on that date fall back to the rate before it.",
      confirmLabel: "Remove rate",
    });
    if (!ok) return;
    setError(null);
    try {
      await orgFoundations.fxRates.remove(r.id);
      setRates((list) => list?.filter((x) => x.id !== r.id) ?? list);
      setNotice(`${r.currency} rate for ${dateLabel(r.asOf)} removed.`);
    } catch (err) {
      setError(errorText(err, "The rate wasn't removed."));
    }
  };

  return (
    <Panel
      title="Exchange rates"
      subtitle={`What one unit of each currency is worth in ${baseCode}, by date. Foreign-currency postings use the latest rate on or before their date.`}
      icon={ArrowLeftRight}
      hue="sky"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && <p className="mb-4 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">{notice}</p>}
      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      <form onSubmit={add} noValidate aria-label="Add an exchange rate" className="mb-5 grid gap-3 rounded-2xl bg-neutral-50/80 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start">
        <div>
          <label htmlFor="fx-currency" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Currency
          </label>
          <CurrencySelect
            id="fx-currency"
            value={currency}
            onChange={setCurrency}
            exclude={base ? [base] : undefined}
            invalid={Boolean(errors.currency)}
            describedBy={errors.currency ? "fx-currency-err" : undefined}
          />
          <FieldError id="fx-currency-err" message={errors.currency} />
        </div>
        <div>
          <label htmlFor="fx-rate" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Rate in {baseCode}
          </label>
          <input
            id="fx-rate"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="1545.25"
            aria-invalid={errors.rate ? true : undefined}
            aria-describedby={errors.rate ? "fx-rate-err" : undefined}
            className={cx(inputClass, "tabular-nums")}
          />
          <FieldError id="fx-rate-err" message={errors.rate} />
        </div>
        <div>
          <label htmlFor="fx-asof" className="mb-1.5 block text-sm font-medium text-neutral-700">
            As of
          </label>
          <input
            id="fx-asof"
            type="date"
            value={asOf}
            max={todayIso()}
            onChange={(e) => setAsOf(e.target.value)}
            aria-invalid={errors.asOf ? true : undefined}
            className={inputClass}
          />
          <FieldError message={errors.asOf} />
        </div>
        <div className="sm:pt-[26px]">
          <Button type="submit" icon={Plus} disabled={adding} className="w-full sm:w-auto">
            {adding ? "Adding…" : "Add rate"}
          </Button>
        </div>
      </form>

      {rates === null && !loadError ? (
        <Skeleton className="h-[240px]" />
      ) : groups.length === 0 ? (
        <Empty icon={ArrowLeftRight} hue="sky" title="No exchange rates yet." hint={`Add a rate above for each currency you trade in besides ${baseCode}.`} />
      ) : active ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,240px)_1fr]">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Currencies">
            {groups.map((g) => {
              const on = g.currency === active.currency;
              return (
                <li key={g.currency} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected(g.currency)}
                    className={cx(
                      "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                      on ? "border-primary-300 bg-primary-50" : "border-neutral-200 bg-white hover:border-neutral-300",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-sm font-semibold", on ? "text-primary-700" : "text-neutral-900")}>{g.currency}</span>
                      <span className="block text-xs tabular-nums text-neutral-500">
                        {g.latest.rate} {baseCode}
                      </span>
                    </span>
                    <Sparkline values={g.rates.map((r) => Number(r.rate))} hue={on ? "blue" : "sky"} width={64} height={24} label={`${g.currency} rate history`} format={fmt} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold text-neutral-900">
                1 {active.currency} in {baseCode}
              </h3>
              <Chip hue="sky">
                {active.rates.length} {active.rates.length === 1 ? "rate" : "rates"}
              </Chip>
            </div>
            <MultiLine
              labels={active.rates.map((r) => dateLabel(r.asOf))}
              series={[{ key: active.currency, label: `${active.currency} in ${baseCode}`, hue: "sky", values: active.rates.map((r) => Number(r.rate)), area: true }]}
              caption={`${active.currency} to ${baseCode} rate by date`}
              format={fmt}
              height={180}
            />
            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <caption className="sr-only">{active.currency} rates by date</caption>
                <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">As of</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Rate</th>
                    <th scope="col" className="px-4 py-2.5">Source</th>
                    <th scope="col" className="px-4 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {[...active.rates].reverse().map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-neutral-700">{dateLabel(r.asOf)}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-neutral-900">{r.rate}</td>
                      <td className="px-4 py-2 text-neutral-500">{r.source ?? "Entered by hand"}</td>
                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => void remove(r)}
                          aria-label={`Remove the ${r.currency} rate of ${dateLabel(r.asOf)}`}
                          className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
