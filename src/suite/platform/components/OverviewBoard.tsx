"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Blocks, Building2, Coins, Ticket, TrendingUp, Users } from "lucide-react";
import { ButtonLink, Card, Chip, Empty, PageHeader, Panel, StatGrid } from "@/components/workspace/kit";
import { AreaLine, StatusBars } from "@/components/workspace/charts";
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
 * What needs the owner comes first — a failed webhook or a lapsed licence is
 * worth more attention than any headline number — then the four figures that
 * describe the business, then how the money and the modules are trending.
 */
export default function OverviewBoard() {
  const { user } = useAuth();
  const canSales = canPlatform(user, PERM.sales);

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

  const header = (
    <PageHeader
      eyebrow="Platform"
      title="Overview"
      subtitle="Every organisation, module and payment on the platform."
      actions={
        canPlatform(user, PERM.organisationsManage) ? (
          <ButtonLink href="/suite/platform/organisations?new=1" variant="primary" icon={Building2}>
            New organisation
          </ButtonLink>
        ) : undefined
      }
    />
  );

  if (error) {
    return (
      <div>
        {header}
        <LoadError message={error} onRetry={overview.reload} />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        {header}
        <PageSkeleton rows={2} />
      </div>
    );
  }

  const { organisations, users, seats } = data;
  const money = data.revenue;
  const urgent = alerts.filter((a) => a.severity !== "info");

  return (
    <div className="space-y-6">
      {header}

      {urgent.length > 0 && <AttentionRail alerts={urgent} />}

      <StatGrid cols={4}>
        <StatCard
          featured
          featuredHue="slate"
          icon={Coins}
          label="Revenue this month"
          value={nairaCompact(money.thisMonthKobo)}
          hint="Modules, seats and new organisations"
          delta={percentChange(money.thisMonthKobo, money.lastMonthKobo)}
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
          hint={seats.sold > 0 ? `${Math.round((seats.used / seats.sold) * 100)}% utilised` : "No seats sold yet"}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Revenue"
          subtitle="Gross takings by month"
          icon={TrendingUp}
          hue="blue"
          actions={
            canSales ? (
              <Link
                href="/suite/platform/sales"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                Sales <ArrowRight size={13} aria-hidden />
              </Link>
            ) : undefined
          }
        >
          {!canSales ? (
            <p className="py-10 text-center text-sm text-neutral-500">Your platform role does not include sales.</p>
          ) : salesError ? (
            <LoadError message={salesError} onRetry={revenue.reload} />
          ) : sales === null ? (
            <div className="h-56 animate-pulse rounded-xl bg-neutral-100" aria-hidden />
          ) : sales.series.length < 2 ? (
            <p className="py-10 text-center text-sm text-neutral-500">
              A trend appears once there are two months of sales.
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

        <Panel title="Module adoption" subtitle="Organisations using each module" icon={Blocks} hue="grape">
          {data.modules.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No modules are licensed yet.</p>
          ) : (
            <div className="space-y-4">
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
          )}
          <Link
            href="/suite/platform/modules"
            className="mt-5 inline-flex items-center gap-1 rounded-lg text-xs font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Manage modules <ArrowRight size={13} aria-hidden />
          </Link>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Alerts" subtitle="Most serious first" icon={Bell} hue="rose">
          {alerts.length === 0 ? (
            <Empty icon={Bell} hue="mint" title="Nothing needs you" hint="Failed payments, lapsing licences and stuck jobs show up here." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {alerts.slice(0, 8).map((a, i) => (
                <AlertRow key={`${a.kind}-${a.at}-${i}`} alert={a} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Newest organisations" icon={Building2} hue="sun">
          {data.recentOrganisations.length === 0 ? (
            <Empty
              icon={Building2}
              title="No organisations yet"
              hint="Create the first one to give an institution its own space."
              action={
                <ButtonLink href="/suite/platform/organisations?new=1" size="sm" variant="primary">
                  New organisation
                </ButtonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.recentOrganisations.map((o) => (
                <li key={o.slug}>
                  <Link
                    href={`/suite/platform/organisations/${encodeURIComponent(o.slug)}`}
                    className="flex items-center gap-3 rounded-xl px-1 py-3 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <OrgMark name={o.name} size={36} />
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
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Needs attention</h2>
        <span className="text-xs text-neutral-500">
          {critical > 0 ? `${critical} critical · ` : ""}
          {alerts.length} open
        </span>
      </div>
      <ul className="flex gap-3 overflow-x-auto px-5 py-4" aria-label="Alerts needing attention">
        {alerts.slice(0, 6).map((a, i) => (
          <li key={`${a.kind}-${i}`} className="w-72 shrink-0">
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
    <li className="py-3">
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
        <span className={compact ? "line-clamp-2 text-sm text-neutral-800" : "block text-sm text-neutral-800"}>
          {alert.message}
        </span>
        <span className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
          {!compact && <SeverityChip severity={alert.severity} />}
          {topic && <span className="font-medium text-neutral-600">{topic.label}</span>}
          <When at={alert.at} />
        </span>
      </span>
    </span>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-xl p-1 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      {inner}
    </Link>
  ) : (
    <div className="p-1">{inner}</div>
  );
}
