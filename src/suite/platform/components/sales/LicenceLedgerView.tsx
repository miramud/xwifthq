"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Coins, Download, ScrollText } from "lucide-react";
import { Card, Chip, Empty, Segmented, Toolbar, buttonClass, cx, orbClass } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { OrgMark } from "@/suite/org/components/ui";
import { LICENCE_METHOD_LABEL, type LicenceRow } from "@/lib/api/platform-client";
import {
  platformSales,
  type LicenceLedgerQuery,
  type LicenceLedgerTotals,
} from "@/lib/api/platform-commerce-client";
import { gatewayLabel } from "@/lib/api/platform-billing-client";
import { formatMoney } from "@/lib/money";
import { discountLabel, licenceModuleName } from "../organisations/OrganisationLicences";
import { formatDate, LoadError, ModuleChip, useLoad } from "../ui";

type Channel = NonNullable<LicenceLedgerQuery["channel"]> | "";
type Kind = NonNullable<LicenceLedgerQuery["kind"]> | "";
type Currency = NonNullable<LicenceLedgerQuery["currency"]> | "";

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "", label: "Every channel" },
  { key: "offline", label: "Licensed by hand" },
  { key: "online", label: "Online checkout" },
];

const KINDS: { key: Kind; label: string }[] = [
  { key: "", label: "New and upgrades" },
  { key: "new", label: "New" },
  { key: "upgrade", label: "Upgrades" },
];

const CURRENCIES: { key: Currency; label: string }[] = [
  { key: "", label: "Both currencies" },
  { key: "NGN", label: "NGN" },
  { key: "USD", label: "USD" },
];

/**
 * The licence ledger finance audits: every paid module sale in the period,
 * online and licensed by hand, with the list price and credit beside what was
 * actually paid. Totals are per currency (naira and dollars are never added
 * together), and the same rows download as CSV through the proxy's file branch.
 */
export default function LicenceLedgerView({ from, to }: { from?: string; to?: string }) {
  const [channel, setChannel] = useState<Channel>("");
  const [kind, setKind] = useState<Kind>("");
  const [currency, setCurrency] = useState<Currency>("");

  const query: LicenceLedgerQuery = {
    from,
    to,
    channel: channel || undefined,
    kind: kind || undefined,
    currency: currency || undefined,
  };

  const fetchLedger = useCallback(
    () =>
      platformSales.licences({
        from,
        to,
        channel: channel || undefined,
        kind: kind || undefined,
        currency: currency || undefined,
      }),
    [from, to, channel, kind, currency],
  );
  const { data, error, loading, reload } = useLoad(fetchLedger, "The licence ledger didn't load.");

  const columns: Column<LicenceRow>[] = [
    {
      key: "paid",
      header: "Paid on",
      sortable: true,
      value: (l) => l.paidAt ?? l.createdAt ?? "",
      render: (l) => <span className="whitespace-nowrap tabular-nums text-neutral-600">{l.paidAt ? formatDate(l.paidAt) : "-"}</span>,
    },
    {
      key: "organisation",
      header: "Organisation",
      primary: true,
      sortable: true,
      value: (l) => l.organisation?.name ?? "",
      render: (l) =>
        l.organisation ? (
          <Link
            href={`/suite/platform/organisations/${encodeURIComponent(l.organisation.slug)}?tab=modules`}
            className="flex min-w-0 items-center gap-3 font-medium text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
          >
            <OrgMark name={l.organisation.name} size={32} />
            <span className="min-w-0">
              <span className="block truncate">{l.organisation.name}</span>
              <span className="block truncate font-mono text-xs font-normal text-neutral-500">{l.reference}</span>
            </span>
          </Link>
        ) : (
          <span className="font-mono text-xs text-neutral-500">{l.reference}</span>
        ),
    },
    {
      key: "kind",
      header: "Sale",
      value: (l) => `${l.kind} ${l.channel}`,
      render: (l) => (
        <span className="flex flex-wrap gap-1">
          <Chip hue={l.kind === "upgrade" ? "coral" : "mint"} dot>
            {l.kind === "upgrade" ? "Upgrade" : "New purchase"}
          </Chip>
          {l.channel === "offline" ? (
            <Chip hue="grape" icon={BadgeCheck}>
              By hand
            </Chip>
          ) : (
            <Chip hue="sky">Online · {gatewayLabel(l.gateway)}</Chip>
          )}
        </span>
      ),
    },
    {
      key: "modules",
      header: "Modules",
      value: (l) => l.modules.map((m) => licenceModuleName(m)).join(" "),
      render: (l) => (
        <span className="min-w-0">
          <span className="flex flex-wrap gap-1">
            {l.modules.map((m) => (
              <ModuleChip key={m} moduleKey={m} label={licenceModuleName(m)} />
            ))}
          </span>
          <span className="mt-1 block text-xs tabular-nums text-neutral-500">
            {l.modulesBefore} → {l.modulesAfter} modules
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Paid / list",
      align: "right",
      sortable: true,
      value: (l) => l.amountMinor,
      render: (l) => (
        <span className="tabular-nums">
          <span className="block font-semibold text-neutral-900">{formatMoney(l.amountMinor, l.currency)}</span>
          <span className="block text-xs text-neutral-500">
            List {formatMoney(l.listPriceMinor, l.currency)}
            {l.creditMinor > 0 && ` · credit ${formatMoney(l.creditMinor, l.currency)}`}
          </span>
          <span className={cx("block text-xs", l.discountMinor > 0 ? "text-sun-700" : "text-neutral-500")}>
            {discountLabel(l.discountMinor, l.currency)}
          </span>
        </span>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      hideOnMobile: true,
      value: (l) => `${l.paymentReference ?? ""} ${l.recordedBy?.name ?? ""}`,
      render: (l) => (
        <span className="min-w-0 text-xs text-neutral-600">
          <span className="block text-sm text-neutral-800">
            {l.paymentMethod ? (LICENCE_METHOD_LABEL[l.paymentMethod] ?? l.paymentMethod) : "-"}
          </span>
          <span className="block truncate font-mono">{l.paymentReference ?? "No reference"}</span>
          <span className="block">
            {l.recordedBy ? `Recorded by ${l.recordedBy.name}` : l.paidBy ? `Paid by ${l.paidBy.name}` : ""}
          </span>
        </span>
      ),
    },
  ];

  const filtered = Boolean(channel || kind || currency || from || to);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Toolbar>
          <Segmented label="Channel" value={channel} onChange={setChannel} options={CHANNELS} />
          <Segmented label="New or upgrade" value={kind} onChange={setKind} options={KINDS} />
          <Segmented label="Currency" value={currency} onChange={setCurrency} options={CURRENCIES} />
        </Toolbar>
        {/* A plain link: the proxy streams the file with its own name. */}
        <a href={platformSales.licencesCsvUrl(query)} download className={buttonClass("secondary", "sm")}>
          <Download size={15} aria-hidden />
          Download CSV
        </a>
      </div>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-72" />
      ) : (
        <div className={cx("space-y-5 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          {data.totals.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2">
              {data.totals.map((t) => (
                <CurrencyTotals key={t.currency} totals={t} />
              ))}
            </div>
          )}
          <DataView
            rows={data.data}
            columns={columns}
            rowKey={(l) => l.id}
            storageKey="platform.sales.licences"
            caption="Licence ledger"
            searchPlaceholder="Search organisations, references…"
            empty={
              <Card>
                <Empty
                  icon={ScrollText}
                  hue="grape"
                  title={filtered ? "No module sales match" : "No module sales yet"}
                  hint={
                    filtered
                      ? "Widen the dates or clear a filter."
                      : "Licences recorded on an organisation's Modules tab, and online module purchases, show up here."
                  }
                />
              </Card>
            }
          />
        </div>
      )}
    </div>
  );
}

/** One currency's figures: what was paid against what the ladder asked. */
function CurrencyTotals({ totals: t }: { totals: LicenceLedgerTotals }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <span className={cx("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", orbClass(t.currency === "USD" ? "sky" : "mint"))}>
          <Coins size={24} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[13px] font-medium text-neutral-500">
              {t.currency} · {t.sales} sale{t.sales === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-neutral-500">{discountLabel(t.discountMinor, t.currency)}</p>
          </div>
          <p className="mt-1 text-[26px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">
            {formatMoney(t.paidMinor, t.currency)}
          </p>
          <p className="text-xs text-neutral-500">Paid</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-neutral-50 p-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">List price</dt>
          <dd className="font-semibold tabular-nums text-neutral-900">{formatMoney(t.listPriceMinor, t.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Credit</dt>
          <dd className="font-semibold tabular-nums text-neutral-900">{formatMoney(t.creditMinor, t.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Discount</dt>
          <dd className="font-semibold tabular-nums text-neutral-900">{formatMoney(t.discountMinor, t.currency)}</dd>
        </div>
      </dl>
      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${t.currency} sales by channel and kind`}>
        <li>
          <Chip hue="grape">{t.offline} by hand</Chip>
        </li>
        <li>
          <Chip hue="sky">{t.online} online</Chip>
        </li>
        <li>
          <Chip hue="mint">{t.newPurchases} new</Chip>
        </li>
        <li>
          <Chip hue="coral">
            {t.upgrades} upgrade{t.upgrades === 1 ? "" : "s"}
          </Chip>
        </li>
      </ul>
    </Card>
  );
}
