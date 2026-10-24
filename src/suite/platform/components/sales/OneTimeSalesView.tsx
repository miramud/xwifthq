"use client";

import { useCallback } from "react";
import { Coins, Filter, GitBranch, Inbox, Layers, Rocket, UserPlus } from "lucide-react";
import { Chip, Empty, Panel, StatGrid, ViewAllLink } from "@/components/workspace/kit";
import { ProgressRing, StatusBars } from "@/components/workspace/charts";
import type { Hue } from "@/components/workspace/modules";
import { StatCard } from "@/suite/lms/components/ui/ws";
import {
  SALES_REQUEST_STATUS_LABEL,
  SALES_REQUEST_TYPE_LABEL,
  platformOneTimeSales,
  type ByCurrencyMinor,
  type OneTimeSales,
  type SalesRequestStatus,
  type SalesRequestType,
} from "@/lib/api/platform-billing-client";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { LoadError, PageSkeleton, useLoad } from "../ui";

const TIER_HUE: Hue[] = ["sky", "blue", "grape", "coral", "sun"];

const CHANNEL_LABEL: Record<string, string> = { online: "Online checkout", offline: "Licensed by hand" };
const KIND_LABEL: Record<string, string> = { new: "New purchase", upgrade: "Upgrade" };

/** "₦5M · $8K": each currency on its own, never added together. */
function perCurrency(by: ByCurrencyMinor): string {
  const parts = Object.entries(by)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([c, v]) => formatMoneyCompact(v, c));
  return parts.length ? parts.join(" · ") : "Nothing paid";
}

const REQUEST_STATUS_HUE: Record<SalesRequestStatus, Hue> = {
  new: "sun",
  contacted: "sky",
  won: "mint",
  lost: "slate",
};

/**
 * One-time sales (26 Sep 2026): modules are bought once, so the questions are
 * how far up the ladder organisations buy, in which currency, how many
 * self-serve sign-ups finish paying, and what the team is being asked for by
 * request (source code, dedicated servers). Naira and dollars are never added
 * together: each currency is its own total.
 */
export default function OneTimeSalesView({ from, to }: { from?: string; to?: string }) {
  const fetchSummary = useCallback(() => platformOneTimeSales.summary({ from, to }), [from, to]);
  const { data, error, reload } = useLoad(fetchSummary, "One-time sales didn't load.");

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton stats={4} />;

  return <OneTimeSalesBody data={data} />;
}

export function OneTimeSalesBody({ data }: { data: OneTimeSales }) {
  const { onboarding } = data;
  const finished = onboarding.started > 0 ? Math.round((onboarding.paid / onboarding.started) * 100) : null;
  const requestsNew = data.salesRequests.byStatus.new ?? 0;
  const requestsTotal = Object.values(data.salesRequests.byStatus).reduce((t, n) => t + (n ?? 0), 0);

  const currencies = data.byCurrency.map((c) => c.currency);
  const hasSales = data.byTier.length > 0;

  return (
    <div className="space-y-6">
      <StatGrid cols={4}>
        {data.byCurrency.length === 0 ? (
          <StatCard featured featuredHue="mint" icon={Coins} label="One-time sales" value={formatMoney(0, "NGN")} hint="Nothing paid in this period" />
        ) : (
          data.byCurrency.slice(0, 2).map((c, i) => (
            <StatCard
              key={c.currency}
              featured={i === 0}
              featuredHue="mint"
              icon={Coins}
              hue="mint"
              label={`Sales in ${c.currency}`}
              value={formatMoneyCompact(c.grossMinor, c.currency)}
              hint={`${c.orders.toLocaleString("en-NG")} order${c.orders === 1 ? "" : "s"}`}
            />
          ))
        )}
        <StatCard
          icon={Rocket}
          hue="blue"
          label="Self-serve sign-ups paid"
          value={onboarding.paid.toLocaleString("en-NG")}
          hint={finished === null ? "No sign-ups started" : `${finished}% of ${onboarding.started} started`}
        />
        <StatCard
          icon={Inbox}
          hue="sun"
          label="New sales requests"
          value={requestsNew.toLocaleString("en-NG")}
          hint={`${requestsTotal} in total`}
          href="/suite/platform/sales-requests?status=new"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="By step on the ladder" subtitle="Paid orders by how many modules the buyer owns afterwards" icon={Layers} hue="grape">
          {!hasSales ? (
            <p className="py-10 text-center text-sm text-neutral-500">No one-time sales in this period.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {currencies.map((currency) => {
                const rows = data.byTier.filter((t) => t.currency === currency).sort((a, b) => a.modules - b.modules);
                if (rows.length === 0) return null;
                return (
                  <div key={currency}>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{currency}</p>
                    <StatusBars
                      caption={`Sales in ${currency} by number of modules`}
                      format={(v) => formatMoneyCompact(v, currency)}
                      data={rows.map((t) => ({
                        label: `${t.modules} module${t.modules === 1 ? "" : "s"}`,
                        value: t.grossMinor,
                        hue: TIER_HUE[(t.modules - 1) % TIER_HUE.length],
                        note: `${t.orders} order${t.orders === 1 ? "" : "s"}`,
                      }))}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Self-serve onboarding" subtitle="New organisations that sign themselves up" icon={UserPlus} hue="blue">
          <Funnel onboarding={onboarding} />
        </Panel>
      </div>

      {(data.byChannel?.length || data.byKind?.length) ? (
        <Panel
          title="How modules were sold"
          subtitle="Online checkout against licences recorded by hand, and first purchases against upgrades. Bars count orders."
          icon={GitBranch}
          hue="sky"
          actions={<ViewAllLink href="/suite/platform/sales?view=licences">Licence ledger</ViewAllLink>}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Channel</p>
              {data.byChannel?.length ? (
                <StatusBars
                  caption="Module orders by channel"
                  format={(v) => `${v} order${v === 1 ? "" : "s"}`}
                  data={data.byChannel.map((c) => ({
                    label: CHANNEL_LABEL[c.channel] ?? c.channel,
                    value: c.orders,
                    hue: c.channel === "offline" ? "grape" : "sky",
                    note: perCurrency(c.byCurrency),
                  }))}
                />
              ) : (
                <p className="text-sm text-neutral-500">No module sales in this period.</p>
              )}
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">New or upgrade</p>
              {data.byKind?.length ? (
                <StatusBars
                  caption="Module orders by new purchase or upgrade"
                  format={(v) => `${v} order${v === 1 ? "" : "s"}`}
                  data={data.byKind.map((k) => ({
                    label: KIND_LABEL[k.kind] ?? k.kind,
                    value: k.orders,
                    hue: k.kind === "upgrade" ? "coral" : "mint",
                    note: perCurrency(k.byCurrency),
                  }))}
                />
              ) : (
                <p className="text-sm text-neutral-500">No module sales in this period.</p>
              )}
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="Sales requests"
        subtitle="Source code, dedicated servers, enterprise asks and module licences"
        icon={Filter}
        hue="sun"
        actions={<ViewAllLink href="/suite/platform/sales-requests" />}
      >
        {requestsTotal === 0 ? (
          <Empty icon={Inbox} hue="sun" title="No sales requests yet" hint="Requests from the pricing page show up here." />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">By status</p>
              <ul className="flex flex-wrap gap-2">
                {(Object.keys(SALES_REQUEST_STATUS_LABEL) as SalesRequestStatus[]).map((s) => (
                  <li key={s}>
                    <Chip hue={REQUEST_STATUS_HUE[s]} dot>
                      {SALES_REQUEST_STATUS_LABEL[s]} · {data.salesRequests.byStatus[s] ?? 0}
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">By type</p>
              <StatusBars
                caption="Sales requests by type"
                data={(Object.keys(SALES_REQUEST_TYPE_LABEL) as SalesRequestType[]).map((t, i) => ({
                  label: SALES_REQUEST_TYPE_LABEL[t],
                  value: data.salesRequests.byType[t] ?? 0,
                  hue: (["grape", "sky", "coral", "blue"] as Hue[])[i] ?? "slate",
                }))}
              />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Funnel({ onboarding }: { onboarding: OneTimeSales["onboarding"] }) {
  const steps: { label: string; value: number; hue: Hue }[] = [
    { label: "Started checkout", value: onboarding.started, hue: "sky" },
    { label: "Paid and onboarded", value: onboarding.paid, hue: "mint" },
    { label: "Still pending", value: onboarding.pending, hue: "sun" },
    { label: "Abandoned", value: onboarding.abandoned, hue: "slate" },
  ];
  if (onboarding.started === 0) {
    return <p className="py-10 text-center text-sm text-neutral-500">No sign-ups started in this period.</p>;
  }
  const paidShare = Math.round((onboarding.paid / onboarding.started) * 100);
  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <ProgressRing
          value={onboarding.paid}
          max={onboarding.started}
          hue="mint"
          size={132}
          display={`${paidShare}%`}
          label="paid"
          caption="Sign-ups that paid and onboarded"
        />
      </div>
      <StatusBars caption="Self-serve onboarding funnel" data={steps} />
    </div>
  );
}
