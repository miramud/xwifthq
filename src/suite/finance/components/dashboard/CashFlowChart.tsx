"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Legend, MultiLine } from "@/components/workspace/charts";
import { FINANCE_DATA } from "@/lib/suite-data";

/**
 * Cash in against cash out, eight months.
 *
 * `FINANCE_DATA.cashflow` is one series, and its September value is the cash
 * position on the KPI row to the decimal (126 against ₦126.4M), so this reads
 * it as the running cash balance and derives the two flows that produce it:
 * in each month `in - out` is exactly the step from one balance to the next.
 * Nothing is invented that the fixture then contradicts: the hidden table
 * below prints all four columns so a reader can check the arithmetic.
 *
 * The two series differ by dash as well as by hue (cash out is dashed), so
 * colour is never the only thing telling them apart.
 */

interface FlowMonth {
  label: string;
  /** ₦ millions. */
  in: number;
  out: number;
}

const FLOWS: readonly FlowMonth[] = [
  { label: "Feb", in: 55, out: 47 },
  { label: "Mar", in: 61, out: 53 },
  { label: "Apr", in: 44, out: 57 },
  { label: "May", in: 72, out: 50 },
  { label: "Jun", in: 66, out: 53 },
  { label: "Jul", in: 49, out: 56 },
  { label: "Aug", in: 74, out: 53 },
  { label: "Sep", in: 63, out: 55 },
];

/** The fixture's own series, read as the closing balance for each month. */
const CLOSING = FINANCE_DATA.cashflow;

const latest = FLOWS[FLOWS.length - 1];
const latestNet = latest.in - latest.out;
const latestClosing = CLOSING[CLOSING.length - 1];

export function CashFlowChart() {
  return (
    <figure className="m-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-xl bg-mint-50 px-3 py-2">
            <ArrowDownLeft size={14} className="text-mint-700" aria-hidden />
            <dt className="font-medium text-mint-700">Cash in, Sep</dt>
            <dd className="font-bold tabular-nums text-neutral-900">₦{latest.in}m</dd>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-3 py-2">
            <ArrowUpRight size={14} className="text-coral-700" aria-hidden />
            <dt className="font-medium text-coral-700">Cash out, Sep</dt>
            <dd className="font-bold tabular-nums text-neutral-900">₦{latest.out}m</dd>
          </div>
        </dl>
        <Legend
          items={[
            { label: "Cash in", hue: "mint" },
            { label: "Cash out", hue: "coral", dashed: true },
          ]}
        />
      </div>

      <MultiLine
        labels={FLOWS.map((m) => m.label)}
        series={[
          { key: "in", label: "Cash in", hue: "mint", values: FLOWS.map((m) => m.in), area: true },
          { key: "out", label: "Cash out", hue: "coral", values: FLOWS.map((m) => m.out), dashed: true },
        ]}
        format={(v) => `₦${v}m`}
        caption="Cash in against cash out, February to September, in naira millions. Cash in swings between 44 and 74 a month; cash out holds between 47 and 57. Cash in exceeds cash out in six of the eight months."
        height={200}
      />

      <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
        Naira millions ·{" "}
        <span className="tabular-nums">
          {latestNet > 0 ? "+" : ""}
          {latestNet}
        </span>{" "}
        net in September, closing at <span className="font-semibold tabular-nums text-neutral-900">₦{latestClosing.value}m</span>
      </p>

      {/* The values as a table, with the closing balance the two flows reconcile to. */}
      <table className="sr-only">
        <caption>Monthly cash flow in naira millions: cash in, cash out, net movement and closing cash balance.</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Cash in</th>
            <th scope="col">Cash out</th>
            <th scope="col">Net movement</th>
            <th scope="col">Closing cash</th>
          </tr>
        </thead>
        <tbody>
          {FLOWS.map((month, index) => (
            <tr key={month.label}>
              <th scope="row">{month.label}</th>
              <td>{month.in}</td>
              <td>{month.out}</td>
              <td>
                {month.in - month.out > 0 ? "+" : ""}
                {month.in - month.out}
              </td>
              <td>{CLOSING[index].value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="sr-only">Cash in and cash out are illustrative monthly flows; the closing balance is the module fixture.</figcaption>
    </figure>
  );
}
