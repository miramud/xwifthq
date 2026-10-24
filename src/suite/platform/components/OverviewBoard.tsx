"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Blocks, Building2, Coins, Ticket, TrendingUp, Users } from "lucide-react";
import {
  ButtonLink,
  Card,
  Chip,
  Empty,
  Panel,
  StatGrid,
  ViewAllLink,
  WelcomeBanner,
  bannerButtonClass,
  cx,
} from "@/components/workspace/kit";
import { AreaLine, Donut, StatusBars } from "@/components/workspace/charts";
import { HUE } from "@/components/workspace/modules";
import { StatCard } from "@/suite/lms/components/ui/ws";
import { OrgMark } from "@/suite/org/components/ui";
import { platformOverview, type PlatformAlert } from "@/lib/api/platform-client";
import { platformSales } from "@/lib/api/platform-commerce-client";
import { useAuth } from "@/lib/auth-store";
import { canPlatform, PERM } from "@/suite/platform/access";
import {
  Bullet,
  LoadError,
  moduleHue,
  nairaCompact,
  PageSkeleton,
  percentChange,
  SEVERITY_ORDER,
  SeverityChip,
  SeverityIcon,
  useLoad,
  When,
} from "./ui";

/**
 * The platform at a glance.
 *
 * What needs the owner comes first (a failed webhook or a lapsed licence is
 * worth more attention than any headline number), then the four figures that
 * describe the business, then how the money and the modules are trending.
 */
export default function OverviewBoard() {
  const { user } = useAuth();
  const canSales = canPlatform(user, PERM.sales);
  const canCreate = canPlatform(user, PERM.organisationsManage);

  const fetchOverview = useCallback(() => platformOverview.get(), []);
  const fetchSales = useCallback(
    () => (canSales ? platformSales.report({ interval: "month" }) : Promise.resolve(null)),
    [canSales],
  );
  const overview = useLoad(fetchOverview, "The overview didn't load.");
  const revenue = useLoad(fetchSales, "Revenue didn't load.");
  const { data, error } = overview;
  const sales = revenue.data;
  const salesError = revenue.error;

  const alerts = useMemo(
    () =>
      [...(data?.alerts ?? [])].sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) ||
          new Date(b.at).getTime() - new Date(a.at).getTime(),
      ),
    [data],
  );

  const header = (figure?: React.ComponentProps<typeof WelcomeBanner>["figure"]) => (
    <WelcomeBanner
      name={user?.name}
      eyebrow="Platform console"
      art="chart"
      subtitle="Every organisation, module and payment on the platform, and what needs you today."
      figure={figure}
      actions={
        canCreate ? (
          <>
            <Link href="/suite/platform/organisations?new=1" className={bannerButtonClass("solid")}>
              <Building2 size={16} aria-hidden />
              New organisation
            </Link>
            <Link href="/suite/platform/organisations" className={bannerButtonClass("glass")}>
              See organisations
            </Link>
          </>
        ) : undefined
      }
    />
  );

  if (error) {
    return (
      <div>
        {header()}
        <LoadError message={error} onRetry={overview.reload} />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        {header()}
        <PageSkeleton rows={2} />
      </div>
    );
  }

  const { organisations, users, seats } = data;
  const money = data.revenue;
  const urgent = alerts.filter((a) => a.severity !== "info");
  const monthDelta = percentChange(money.thisMonthKobo, money.lastMonthKobo);
  const adoptionTotal = data.modules.reduce((s, m) => s + Math.max(0, m.organisations), 0);

  return (
    <div className="space-y-6">
      {header({
        label: "Gross takings to date",
        value: nairaCompact(money.grossKobo),
        hint: `${nairaCompact(money.platformFeeKobo)} kept as platform fee`,
      })}

      {urgent.length > 0 && <AttentionRail alerts={urgent} />}

      <StatGrid cols={4}>
        <StatCard
          featured
          featuredHue="blue"
          icon={Coins}
          label="Revenue this month"
          value={nairaCompact(money.thisMonthKobo)}
          hint="Modules, seats and new organisations"
          delta={monthDelta}
          deltaLabel="vs last month"
          href={canSales ? "/suite/platform/sales" : undefined}
        />
        <StatCard
          icon={Building2}
          hue="sun"
          label="Organisations"
          value={organisations.active.toLocaleString("en-NG")}
          unit={`of ${organisations.total.toLocaleString("en-NG")} active`}
          hint={
            organisations.newThisMonth > 0
              ? `${organisations.newThisMonth} new this month`
              : organisations.suspended > 0
                ? `${organisations.suspended} suspended`
                : "None new this month"
          }
          href="/suite/platform/organisations"
        />
        <StatCard
          icon={Users}
          hue="grape"
          label="Active users"
          value={users.active30d.toLocaleString("en-NG")}
          unit={`of ${users.total.toLocaleString("en-NG")}`}
          hint="Signed in within 30 days"
          href="/suite/platform/analytics/usage"
        />
        <StatCard
          icon={Ticket}
          hue="mint"
          label="Seats in use"
          value={seats.used.toLocaleString("en-NG")}
          unit={`of ${seats.sold.toLocaleString("en-NG")} sold`}
          hint={seats.sold > 0 ? `${Math.round((seats.used / seats.sold) * 100)}% in use` : "No seats sold yet"}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Revenue"
          subtitle="Gross takings by month"
          icon={TrendingUp}
          hue="blue"
          actions={canSales ? <ViewAllLink href="/suite/platform/sales">Open sales</ViewAllLink> : undefined}
        >
          <dl className="mb-5 flex flex-wrap gap-2.5">
            <MiniStat label="This month" value={nairaCompact(money.thisMonthKobo)} hue="blue" />
            <MiniStat label="Last month" value={nairaCompact(money.lastMonthKobo)} hue="sky" />
            <MiniStat label="Lifetime gross" value={nairaCompact(money.grossKobo)} hue="mint" />
          </dl>
          {!canSales ? (
            <p className="rounded-2xl bg-neutral-50 py-10 text-center text-sm text-neutral-500">
              Your platform role doesn&apos;t include sales, so the monthly trend is hidden.
            </p>
          ) : salesError ? (
            <LoadError message={salesError} onRetry={revenue.reload} />
          ) : sales === null ? (
            <div className="h-56 animate-pulse rounded-2xl bg-neutral-100" aria-hidden />
          ) : sales.series.length < 2 ? (
            <p className="rounded-2xl bg-neutral-50 py-10 text-center text-sm text-neutral-500">
              The trend appears once there are two months of sales.
            </p>
          ) : (
            <AreaLine
              data={sales.series.map((p) => ({ label: p.period, value: p.grossKobo / 100 }))}
              format={(v) => nairaCompact(v * 100)}
              caption="Gross revenue by month"
              height={220}
            />
          )}
          <div className="mt-5 border-t border-neutral-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Where lifetime revenue went
            </p>
            <StatusBars
              caption="Where lifetime revenue went"
              format={(v) => nairaCompact(v)}
              data={[
                { label: "Platform fee", value: money.platformFeeKobo, hue: "blue" },
                {
                  label: "Paid to organisations",
                  value: Math.max(0, money.grossKobo - money.platformFeeKobo),
                  hue: "mint",
                },
              ]}
            />
          </div>
        </Panel>

        <Panel
          title="Module adoption"
          subtitle="Organisations using each module"
          icon={Blocks}
          hue="grape"
          actions={<ViewAllLink href="/suite/platform/modules">Manage modules</ViewAllLink>}
        >
          {data.modules.length === 0 ? (
            <Empty icon={Blocks} hue="grape" title="No modules licensed yet" hint="Switch a module on for an organisation and it shows here." />
          ) : (
            <div className="space-y-5">
              <Donut
                data={data.modules.map((m) => ({ label: m.label, value: m.organisations, hue: moduleHue(m.key) }))}
                total={adoptionTotal.toLocaleString("en-NG")}
                centerLabel="switched on"
                caption="Organisations using each module"
                legend="below"
                size={168}
              />
              <div className="space-y-4 border-t border-neutral-100 pt-4">
                {data.modules.map((m) => (
                  <Bullet
                    key={m.key}
                    label={m.label}
                    value={m.organisations}
                    max={Math.max(organisations.total, 1)}
                    hue={moduleHue(m.key)}
                    note={`${m.activeUsers30d.toLocaleString("en-NG")} active users in 30 days`}
                  />
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Newest organisations"
          subtitle="Who joined most recently, and what they use"
          icon={Building2}
          hue="sun"
          actions={data.recentOrganisations.length > 0 ? <ViewAllLink href="/suite/platform/organisations" /> : undefined}
        >
          {data.recentOrganisations.length === 0 ? (
            <Empty
              icon={Building2}
              hue="sun"
              title="No organisations yet"
              hint="Create the first one to give an institution its own space."
              action={
                <ButtonLink href="/suite/platform/organisations?new=1" size="sm" variant="primary">
                  New organisation
                </ButtonLink>
              }
            />
          ) : (
            <ol className="space-y-1">
              {data.recentOrganisations.map((o, i) => (
                <li key={o.slug}>
                  <Link
                    href={`/suite/platform/organisations/${encodeURIComponent(o.slug)}`}
                    className="flex items-center gap-3 rounded-2xl px-2 py-2.5 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-neutral-400" aria-hidden>
                      {i + 1}
                    </span>
                    <OrgMark name={o.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">{o.name}</span>
                      <span className="text-xs text-neutral-500">
                        Joined <When at={o.createdAt} />
                      </span>
                    </span>
                    <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                      {o.modules.slice(0, 3).map((m) => (
                        <Chip key={m} hue={moduleHue(m)}>
                          {m.toUpperCase()}
                        </Chip>
                      ))}
                    </span>
                    <Chip hue={o.modules.length > 0 ? "mint" : "slate"} className="tabular-nums">
                      {o.modules.length} {o.modules.length === 1 ? "module" : "modules"}
                    </Chip>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Alerts" subtitle="Most serious first" icon={Bell} hue="rose">
          {alerts.length === 0 ? (
            <Empty icon={Bell} hue="mint" title="Nothing needs you" hint="Failed payments, lapsing licences and stuck jobs show up here." />
          ) : (
            <ul className="space-y-1">
              {alerts.slice(0, 8).map((a, i) => (
                <AlertRow key={`${a.kind}-${a.at}-${i}`} alert={a} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** A small figure above a chart: the chips over Marketly's traffic plot. */
function MiniStat({ label, value, hue }: { label: string; value: string; hue: "blue" | "sky" | "mint" }) {
  return (
    <div className="flex min-w-[8.5rem] items-center gap-2.5 rounded-2xl border border-neutral-100 bg-neutral-50/70 px-3 py-2">
      <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HUE[hue].dot)} aria-hidden />
      <span className="min-w-0">
        <dt className="text-[11px] font-medium text-neutral-500">{label}</dt>
        <dd className="text-sm font-bold tabular-nums text-neutral-900">{value}</dd>
      </span>
    </div>
  );
}

/**
 * The console's signature: what needs the owner, as a rail across the top of
 * the page. Critical first, then warnings; info waits in the Alerts panel.
 */
function AttentionRail({ alerts }: { alerts: PlatformAlert[] }) {
  const critical = alerts.filter((a) => a.severity === "critical").length;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
        <span className={cx("flex h-10 w-10 items-center justify-center rounded-2xl", HUE.rose.soft)} aria-hidden>
          <AlertTriangle size={18} />
        </span>
        <h2 className="text-base font-bold tracking-tight text-neutral-900">Needs attention</h2>
        <span className="flex flex-wrap gap-1.5">
          {critical > 0 && <Chip hue="rose">{critical} critical</Chip>}
          <Chip hue="sun">{alerts.length} open</Chip>
        </span>
      </div>
      <ul className="flex gap-3 overflow-x-auto px-5 pb-5 pt-4" aria-label="Alerts needing attention">
        {alerts.slice(0, 6).map((a, i) => (
          <li key={`${a.kind}-${i}`} className="w-72 shrink-0 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-1">
            <AlertBody alert={a} compact />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Where an alert leads and what it is about, from its kind. The API sends an
 * `href` for most alerts; these cover the payment ones when it doesn't, so a
 * "payment failed" alert is never a dead end.
 */
export function alertTopic(kind: string): { label: string; href: string } | null {
  const k = kind.toLowerCase();
  // First: a failed welcome or sales email is fixed on Email delivery, even
  // when the kind also names onboarding or sales.
  if (/mail/.test(k)) return { label: "Email delivery", href: "/suite/platform/settings/email" };
  if (/gateway|secret_hash|flutterwave|paystack/.test(k)) return { label: "Payment gateway", href: "/suite/platform/settings/payments" };
  // Before payment matching: "sales_requests.new" names requests, not payments.
  if (/sales_request|source_code|dedicated/.test(k)) return { label: "Sales requests", href: "/suite/platform/sales-requests?status=new" };
  if (/signup|onboard/.test(k)) return { label: "Onboarding", href: "/suite/platform/payments?kind=signup" };
  // Subscriptions were retired on 26 Sep 2026; an older alert still lands on one-time sales.
  if (/subscription|expir|renewal/.test(k)) return { label: "Sales", href: "/suite/platform/sales?view=one-time" };
  if (/payment|abandon|mismatch|orphan|webhook/.test(k)) return { label: "Payments", href: "/suite/platform/payments" };
  return null;
}

function AlertRow({ alert }: { alert: PlatformAlert }) {
  return (
    <li>
      <AlertBody alert={alert} />
    </li>
  );
}

function AlertBody({ alert, compact = false }: { alert: PlatformAlert; compact?: boolean }) {
  const topic = alertTopic(alert.kind);
  const href = alert.href ?? topic?.href ?? null;
  const inner = (
    <span className="flex items-start gap-3">
      <SeverityIcon severity={alert.severity} />
      <span className="min-w-0 flex-1">
        <span className={compact ? "line-clamp-2 text-sm text-neutral-800" : "block text-sm font-medium text-neutral-800"}>
          {alert.message}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {!compact && <SeverityChip severity={alert.severity} />}
          {topic && <span className="font-semibold text-neutral-600">{topic.label}</span>}
          <When at={alert.at} />
        </span>
      </span>
    </span>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-xl p-2 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      {inner}
    </Link>
  ) : (
    <div className="p-2">{inner}</div>
  );
}
