"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, HandCoins, Inbox, Trophy, UserCheck, UserPlus, Wallet } from "lucide-react";
import { Card, Empty, PageHeader, Panel, SearchField, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useAuth } from "@/lib/auth-store";
import { FaceAvatar, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import {
  percentText,
  platformAffiliates,
  type AffiliateStatus,
  type PlatformAffiliateRow,
} from "@/lib/api/affiliate-client";
import { formatMoney } from "@/lib/money";
import { canPlatform, PERM } from "@/suite/platform/access";
import { formatDate, LoadError, Pager, useLoad } from "../ui";
import { affiliateHref, AffiliateStatusChip, earningsFor, moneyList } from "./shared";

type Tab = AffiliateStatus | "all";

function isTab(v: string | null | undefined): v is Tab {
  return v === "pending" || v === "approved" || v === "suspended" || v === "rejected" || v === "all";
}

/**
 * The affiliate programme from the platform's side: who applied, who is
 * sharing a link, and what the programme has earned and paid.
 *
 * Applications are the queue, so their tab comes first, carries the count and
 * is where the page opens unless the link asks for another (`?status=`). A
 * row opens the affiliate, where every decision about them is made.
 */
export default function AffiliatesBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { user } = useAuth();
  const allowed = canPlatform(user, PERM.affiliatesView);
  const initial = search?.get("status");

  const [tab, setTab] = useState<Tab>(isTab(initial) ? initial : "pending");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  // The search goes to the API a moment after typing stops, not per key.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setTerm(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const fetchOverview = useCallback(() => platformAffiliates.overview(), []);
  const overview = useLoad(fetchOverview, "Programme figures didn't load.");

  const fetchList = useCallback(
    () => platformAffiliates.list({ status: tab === "all" ? undefined : tab, search: term || undefined, page }),
    [tab, term, page],
  );
  const list = useLoad(fetchList, "Affiliates didn't load.");

  const counts = overview.data?.stats.affiliates;
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "pending", label: "Applications", count: counts?.pending },
    { key: "approved", label: "Active" },
    { key: "suspended", label: "Suspended" },
    { key: "rejected", label: "Not accepted" },
    { key: "all", label: "All" },
  ];

  const changeTab = (key: string) => {
    if (!isTab(key)) return;
    setTab(key);
    setPage(1);
    router.replace(`${pathname ?? "/suite/platform/affiliates"}?status=${key}`);
  };

  const terms = overview.data?.programme;
  const header = (
    <PageHeader
      eyebrow="Affiliates"
      title="Affiliate programme"
      subtitle={
        terms
          ? `${terms.open ? "Open for applications" : "Closed to new applications"}. Affiliates earn ${percentText(terms.commissionPercent)} of a referred organisation's first payment, which gets ${percentText(terms.discountPercent)} off.`
          : "Review applications, follow referrals and pay what affiliates have earned."
      }
      tabs={tabs}
      activeTab={tab}
      onTab={changeTab}
    />
  );

  if (user && !allowed) {
    return (
      <div>
        {header}
        <Card>
          <Empty icon={Inbox} title="You can't see the affiliate programme" hint="Ask a platform owner for access to affiliates." />
        </Card>
      </div>
    );
  }

  const stats = overview.data?.stats;
  // Rows keep the API's order, with any application lifted to the top of "All".
  const rows = list.data
    ? tab === "all"
      ? [...list.data.data].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"))
      : list.data.data
    : [];

  const columns: Column<PlatformAffiliateRow>[] = [
    {
      key: "name",
      header: "Affiliate",
      primary: true,
      value: (a) => a.name,
      render: (a) => (
        <span className="flex min-w-0 items-center gap-3">
          <FaceAvatar name={a.name} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{a.name}</span>
            <span className="block truncate text-xs font-normal text-neutral-500">{a.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "code",
      header: "Code",
      value: (a) => a.code ?? "",
      render: (a) => (a.code ? <span className="font-mono text-sm text-neutral-800">{a.code}</span> : <span className="text-neutral-500">-</span>),
    },
    { key: "status", header: "Status", value: (a) => a.status, render: (a) => <AffiliateStatusChip status={a.status} label={a.statusLabel} /> },
    {
      key: "referred",
      header: "Referred",
      align: "right",
      hideOnMobile: true,
      value: (a) => a.referralCount,
      render: (a) => (
        <span className="whitespace-nowrap">
          {a.referralCount} <span className="text-xs text-neutral-500">· {a.payingReferralCount} paying</span>
        </span>
      ),
    },
    {
      key: "earned",
      header: "Earned",
      align: "right",
      hideOnMobile: true,
      value: (a) => moneyList(a.earned),
      render: (a) => <span className="whitespace-nowrap">{moneyList(a.earned)}</span>,
    },
    {
      key: "applied",
      header: "Applied on",
      hideOnMobile: true,
      value: (a) => a.createdAt ?? "",
      render: (a) => <span className="whitespace-nowrap">{formatDate(a.createdAt)}</span>,
    },
  ];

  const emptyCopy: Record<Tab, { title: string; hint: string }> = {
    pending: { title: "No applications waiting", hint: "New applications from the affiliate page show here for review." },
    approved: { title: "No active affiliates", hint: "Approve an application and the affiliate shows here." },
    suspended: { title: "Nobody is suspended", hint: "A suspended affiliate's link stops earning and stops giving the discount." },
    rejected: { title: "No turned down applications", hint: "Applications you turn down are kept here." },
    all: { title: "No affiliates yet", hint: "Applications from the affiliate page show here." },
  };

  return (
    <div className="space-y-6">
      {header}

      {overview.error ? (
        <LoadError message={overview.error} onRetry={overview.reload} />
      ) : !stats ? (
        <Skeleton className="h-[104px]" />
      ) : (
        <StatGrid cols={5}>
          <StatCard
            featured={stats.affiliates.pending > 0}
            featuredHue="sun"
            icon={UserPlus}
            hue="sun"
            label="Applications waiting"
            value={stats.affiliates.pending}
            hint={stats.affiliates.pending > 0 ? "Review them in Applications" : "Nothing to review"}
          />
          <StatCard
            icon={UserCheck}
            hue="mint"
            label="Active affiliates"
            value={stats.affiliates.approved}
            hint={`${stats.affiliates.suspended} suspended`}
          />
          <StatCard
            icon={Building2}
            hue="sky"
            label="Organisations referred"
            value={stats.referrals}
            hint={`${stats.payingReferrals} paying${stats.conversionPercent !== null ? ` · ${percentText(stats.conversionPercent)} convert` : ""}`}
          />
          <StatCard
            icon={HandCoins}
            hue="grape"
            label="Ready to pay"
            value={moneyList(earningsFor(stats.earnings, "approved"), true)}
            hint={`On hold: ${moneyList(earningsFor(stats.earnings, "pending"), true)}`}
            href="/suite/platform/affiliates/commissions?status=approved"
          />
          <StatCard
            icon={Wallet}
            hue="blue"
            label="Paid out"
            value={moneyList(stats.paidOut, true)}
            href="/suite/platform/affiliates/payouts"
          />
        </StatGrid>
      )}

      <section aria-label="Affiliates">
        <SearchField value={query} onChange={setQuery} placeholder="Search by name, email or code" label="Search affiliates" className="mb-4 w-full sm:max-w-sm" />

        {list.error ? (
          <LoadError message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <DataView
              rows={rows}
              columns={columns}
              rowKey={(a) => a.id}
              rowHref={(a) => affiliateHref(a.id)}
              storageKey="platform.affiliates"
              caption="Affiliates"
              searchable={false}
              views={["table", "list"]}
              empty={
                <Card>
                  <Empty
                    icon={Inbox}
                    title={term ? "Nobody matches that search" : emptyCopy[tab].title}
                    hint={term ? "Try part of a name, an email or a code." : emptyCopy[tab].hint}
                  />
                </Card>
              }
            />
            <Pager page={list.data.meta.currentPage} lastPage={list.data.meta.lastPage} total={list.data.meta.total} onPage={setPage} noun="affiliates" />
          </>
        )}
      </section>

      {stats && stats.topAffiliates.length > 0 && (
        <Panel title="Top affiliates" subtitle="By commission earned, in each currency" icon={Trophy} hue="sun" bodyClassName="px-5 pb-3 pt-2">
          <ol className="divide-y divide-neutral-100">
            {stats.topAffiliates.map((t, i) => (
              <li key={`${t.id}-${t.currency}`} className="flex items-center gap-3 py-3">
                <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-neutral-500">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={affiliateHref(t.id)}
                    className="inline-flex min-h-11 items-center rounded-lg font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    {t.name ?? "Unnamed affiliate"}
                    {t.code && <span className="ml-2 font-mono text-xs font-normal text-neutral-500">{t.code}</span>}
                  </Link>
                  <span className="block text-xs text-neutral-500">
                    {t.organisations} organisation{t.organisations === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{formatMoney(t.earnedMinor, t.currency)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
