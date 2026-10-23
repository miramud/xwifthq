"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BadgeDollarSign,
  Building2,
  CircleSlash,
  Gauge,
  Loader2,
  PieChart,
  RefreshCw,
  Siren,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { formatCompactNaira, formatDate } from "@/lib/console-data";
import {
  platformInsights as api,
  ApiError,
  type AttentionItem,
  type Portfolio,
  type PortfolioRow,
} from "@/lib/api/saas-client";
import { useAuth } from "@/lib/auth-store";
import { Button, Card, Chip, Empty, PageHeader, Panel, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { AreaLine, Legend, SegmentedGauge } from "@/components/workspace/charts";
import { HUE, type Hue } from "@/components/workspace/modules";
import { ErrorNote, StatCard } from "@/suite/lms/components/ui/ws";
import { OrgMark } from "@/suite/org/components/ui";
import { canPlatform, PERM } from "@/suite/platform/access";

/**
 * The platform owner's portfolio.
 *
 * Every other dashboard in this product answers "how is my institution doing".
 * This one exists for the questions only the owner has, and the page is built
 * around the sharpest of them: **how much of this platform is one customer?**
 *
 * So the hero is a single concentration bar, one segment per institution,
 * widths proportional to revenue. A table sorted by revenue tells you who is
 * biggest; the bar tells you whether "biggest" means 12% or 71%, which is the
 * fact that changes what the owner does next.
 *
 * The attention list sits high on the page, above the table, because an owner
 * opens this page to find out who needs them today. Reasons are listed
 * verbatim rather than rolled into a health score: "at 98% of seats" and
 * "quiet for 40 days" are different conversations, and averaging them loses
 * the only useful part.
 */

/* ------------------------------------------------------------------ */
/*  Concentration bar — the signature                                  */
/* ------------------------------------------------------------------ */

/**
 * Enough distinct hues for a realistic tenant list, then everything else is
 * grouped into one "others" segment rather than cycling colours back round —
 * two institutions sharing a colour would misread as one.
 */
const SEGMENT_HUES: Hue[] = ["blue", "sky", "mint", "sun", "rose", "grape"];
const MARKETPLACE_CLASS = "bg-neutral-400";
const OTHERS_CLASS = "bg-neutral-300";

interface Segment {
  name: string;
  value: number;
  percent: number;
  className: string;
}

function segmentsFrom(rows: PortfolioRow[]): Segment[] {
  const earning = rows.filter((row) => row.grossRevenue > 0);
  const total = earning.reduce((sum, row) => sum + row.grossRevenue, 0);

  if (total === 0) return [];

  const named = earning.slice(0, SEGMENT_HUES.length);
  const rest = earning.slice(SEGMENT_HUES.length);

  const segments: Segment[] = named.map((row, i) => ({
    name: row.name,
    value: row.grossRevenue,
    percent: (row.grossRevenue / total) * 100,
    className: row.isMarketplace ? MARKETPLACE_CLASS : HUE[SEGMENT_HUES[i]].bar,
  }));

  if (rest.length > 0) {
    const value = rest.reduce((sum, row) => sum + row.grossRevenue, 0);
    segments.push({
      name: `${rest.length} others`,
      value,
      percent: (value / total) * 100,
      className: OTHERS_CLASS,
    });
  }

  return segments;
}

function ConcentrationBar({ rows, topShare }: { rows: PortfolioRow[]; topShare: number }) {
  const segments = useMemo(() => segmentsFrom(rows), [rows]);

  if (segments.length === 0) {
    return (
      <Empty
        icon={CircleSlash}
        title="No revenue yet"
        hint="Once an institution's learners start buying, this is where the split shows up."
      />
    );
  }

  const leader = segments[0];

  return (
    <div>
      <p className="text-sm text-neutral-600">
        <span className="font-semibold text-neutral-900">{leader.name}</span> is{" "}
        <span className="font-semibold text-neutral-900 tabular-nums">{topShare}%</span> of platform revenue.
      </p>

      <div
        className="mt-4 flex h-11 gap-1 overflow-hidden rounded-xl"
        role="img"
        aria-label={segments.map((s) => `${s.name}: ${Math.round(s.percent)} percent`).join("; ")}
      >
        {segments.map((segment) => (
          <div
            key={segment.name}
            className={cx("min-w-[3px] rounded-lg transition-all", segment.className)}
            style={{ width: `${segment.percent}%` }}
            title={`${segment.name}: ${formatCompactNaira(segment.value)}`}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((segment) => (
          <li key={segment.name} className="flex items-center gap-2.5 rounded-xl bg-neutral-50 px-3 py-2 text-sm">
            <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", segment.className)} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">{segment.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-neutral-500">
              {Math.round(segment.percent)}% · {formatCompactNaira(segment.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Attention list                                                     */
/* ------------------------------------------------------------------ */

const REASON_HUE: Record<AttentionItem["reasons"][number]["kind"], Hue> = {
  suspended: "rose",
  seats: "sun",
  quiet: "slate",
};

function Attention({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <Empty
        icon={Building2}
        hue="mint"
        title="Nothing needs you"
        hint="No institution is suspended, near its seat limit, or has gone quiet."
      />
    );
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {items.map((item) => (
        <li key={item.id ?? item.name} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 sm:w-64 sm:shrink-0">
            <OrgMark name={item.name} size={36} />
            {item.slug ? (
              <Link
                href={`/suite/platform/organisations/${encodeURIComponent(item.slug)}`}
                className="truncate text-sm font-semibold text-neutral-900 hover:text-primary-700"
              >
                {item.name}
              </Link>
            ) : (
              <span className="truncate text-sm font-semibold text-neutral-900">{item.name}</span>
            )}
          </div>

          <ul className="flex min-w-0 flex-wrap gap-2">
            {item.reasons.map((reason) => (
              <li key={reason.kind}>
                <Chip hue={REASON_HUE[reason.kind]} dot={reason.kind !== "suspended"}>
                  {reason.detail}
                </Chip>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Marketplace vs institutions, over time                             */
/* ------------------------------------------------------------------ */

type Span = "12" | "6";

function Growth({ monthly }: { monthly: Portfolio["monthly"] }) {
  const [span, setSpan] = useState<Span>("12");
  const shown = span === "6" ? monthly.slice(-6) : monthly;

  return (
    <Panel
      title="Where growth is coming from"
      subtitle="Institutions against the public marketplace, per month"
      icon={TrendingUp}
      className="lg:col-span-2"
      actions={
        <Segmented
          label="Period"
          value={span}
          onChange={setSpan}
          options={[
            { key: "6", label: "6 months" },
            { key: "12", label: "12 months" },
          ]}
        />
      }
    >
      <AreaLine
        data={shown.map((m) => ({ label: m.month, value: m.institutions }))}
        compare={shown.map((m) => ({ label: m.month, value: m.marketplace }))}
        height={220}
        format={formatCompactNaira}
        caption="Institution revenue per month, with marketplace revenue as the dashed comparison"
      />
      <div className="mt-4">
        <Legend
          items={[
            { label: "Institutions", hue: "blue" },
            { label: "Marketplace", hue: "slate", dashed: true },
          ]}
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Portfolio                                                          */
/* ------------------------------------------------------------------ */

function SeatCell({ row }: { row: PortfolioRow }) {
  if (row.isMarketplace) {
    return <span className="text-xs text-neutral-500">-</span>;
  }

  if (row.seatUtilisation === null) {
    return (
      <span className="text-xs text-neutral-600">
        {row.seatsUsed} <span className="text-neutral-500">/ unlimited</span>
      </span>
    );
  }

  const hot = row.seatUtilisation >= 90;
  return (
    <span className="flex items-center gap-2">
      <span className="ws-hatch hidden h-2 w-16 overflow-hidden rounded-full sm:block">
        <span
          className={cx("block h-full rounded-full", hot ? "bg-sun-500" : "bg-primary-500")}
          style={{ width: `${Math.min(100, row.seatUtilisation)}%` }}
        />
      </span>
      <span className="text-xs tabular-nums text-neutral-600">
        {row.seatsUsed}/{row.seatLimit}
      </span>
    </span>
  );
}

function RowName({ row }: { row: PortfolioRow }) {
  return (
    <span className="flex items-center gap-2">
      {row.slug ? (
        <Link
          href={`/suite/platform/organisations/${encodeURIComponent(row.slug)}`}
          className="font-semibold text-neutral-900 hover:text-primary-700"
        >
          {row.name}
        </Link>
      ) : (
        <span className="font-semibold text-neutral-900">{row.name}</span>
      )}
      {row.status !== "active" && <Chip hue="rose">Suspended</Chip>}
    </span>
  );
}

function PortfolioView({ rows }: { rows: PortfolioRow[] }) {
  const columns: Column<PortfolioRow>[] = [
    {
      key: "name",
      header: "Institution",
      primary: true,
      sortable: true,
      value: (r) => r.name,
      render: (r) => <RowName row={r} />,
    },
    { key: "seats", header: "Seats", sortable: true, value: (r) => r.seatUtilisation ?? -1, render: (r) => <SeatCell row={r} /> },
    {
      key: "people",
      header: "People",
      sortable: true,
      value: (r) => r.students,
      render: (r) => (
        <span className="text-xs tabular-nums text-neutral-600">
          {r.students} learners
          <span className="text-neutral-500"> · {r.instructors} instructors</span>
        </span>
      ),
    },
    {
      key: "courses",
      header: "Courses",
      sortable: true,
      value: (r) => r.publishedCourses,
      hideOnMobile: true,
      render: (r) => (
        <span className="text-xs tabular-nums text-neutral-600">
          {r.publishedCourses}
          <span className="text-neutral-500"> / {r.totalCourses}</span>
        </span>
      ),
    },
    {
      key: "completion",
      header: "Completion",
      sortable: true,
      value: (r) => r.completionRate,
      hideOnMobile: true,
      render: (r) => <span className="text-xs tabular-nums text-neutral-600">{r.completionRate}%</span>,
    },
    {
      key: "gross",
      header: "Gross",
      align: "right",
      sortable: true,
      value: (r) => r.grossRevenue,
      render: (r) => (
        <span className="text-sm font-semibold tabular-nums text-neutral-900">{formatCompactNaira(r.grossRevenue)}</span>
      ),
    },
    {
      key: "net",
      header: "Net",
      align: "right",
      sortable: true,
      value: (r) => r.netRevenue,
      render: (r) => <span className="text-sm tabular-nums text-neutral-600">{formatCompactNaira(r.netRevenue)}</span>,
    },
    {
      key: "active",
      header: "Last active",
      align: "right",
      sortable: true,
      value: (r) => r.lastActiveAt ?? "",
      render: (r) => (
        <span className="text-xs text-neutral-500">{r.lastActiveAt === null ? "Never" : formatDate(r.lastActiveAt)}</span>
      ),
    },
  ];

  return (
    <DataView
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id ?? "marketplace"}
      storageKey="org.platform.portfolio"
      caption="Portfolio"
      searchPlaceholder="Search institutions"
      matches={(r, q) => r.name.toLowerCase().includes(q)}
      renderCard={(r) => (
        <div className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <OrgMark name={r.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px]">
                <RowName row={r} />
              </p>
              <p className="text-xs text-neutral-500">
                Last active {r.lastActiveAt === null ? "never" : formatDate(r.lastActiveAt)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Gross</p>
              <p className="text-lg font-bold tabular-nums text-neutral-900">{formatCompactNaira(r.grossRevenue)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Completion</p>
              <p className="text-lg font-bold tabular-nums text-neutral-900">{r.completionRate}%</p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
            <span>
              {r.students} learners · {r.instructors} instructors
            </span>
            <SeatCell row={r} />
          </div>
        </div>
      )}
      renderListItem={(r) => (
        <div className="flex items-center gap-4 px-5 py-3.5">
          <OrgMark name={r.name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              <RowName row={r} />
            </p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {r.students} learners · {r.publishedCourses}/{r.totalCourses} courses · {r.completionRate}% completion
            </p>
          </div>
          <SeatCell row={r} />
          <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-900">
            {formatCompactNaira(r.grossRevenue)}
          </span>
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function RevenuePortfolio() {
  const { user } = useAuth();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = canPlatform(user, PERM.sales);

  const load = useCallback(() => {
    api
      .portfolio()
      .then((data) => {
        setPortfolio(data);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load the portfolio."));
  }, []);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  const heading = (
    <PageHeader
      eyebrow="Platform"
      title="Revenue portfolio"
      subtitle="Every institution together: where the revenue comes from, and who needs a look at."
    />
  );

  if (user && !isOwner) {
    return (
      <div>
        {heading}
        <Card>
          <Empty
            icon={Building2}
            title="This report is the platform owner's"
            hint="It adds every institution together, so it is deliberately out of reach of an institution admin. Your own figures are on the Overview and Revenue pages."
          />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {heading}
        <ErrorNote className="flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" aria-hidden />
          {error}
        </ErrorNote>
        <Button icon={RefreshCw} onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (portfolio === null) {
    return (
      <div>
        {heading}
        <div className="flex items-center gap-2 py-20 text-sm text-neutral-500">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading the portfolio…
        </div>
      </div>
    );
  }

  const { totals } = portfolio;
  const seatShare = totals.seatsSold > 0 ? Math.round((totals.seatsUsed / totals.seatsSold) * 100) : 0;

  return (
    <div className="space-y-6">
      {heading}

      <StatGrid>
        <StatCard
          featured
          featuredHue="sun"
          icon={Building2}
          label="Institutions"
          value={`${totals.activeOrganisations}`}
          hint={totals.suspendedOrganisations > 0 ? `${totals.suspendedOrganisations} suspended` : "all active"}
        />
        <StatCard
          icon={Ticket}
          hue="blue"
          label="Seats used"
          value={`${totals.seatsUsed}`}
          hint={
            totals.seatsSold > 0
              ? `of ${totals.seatsSold} sold${
                  totals.unlimitedOrganisations > 0 ? ` · ${totals.unlimitedOrganisations} unlimited` : ""
                }`
              : "no seat limits set"
          }
        />
        <StatCard
          icon={BadgeDollarSign}
          hue="mint"
          label="Institution revenue"
          value={formatCompactNaira(totals.institutionRevenue)}
          hint={`marketplace ${formatCompactNaira(totals.marketplaceRevenue)}`}
        />
        <StatCard
          icon={Wallet}
          hue="grape"
          label="Net of refunds"
          value={formatCompactNaira(totals.netRevenue)}
          hint={`${totals.platformFeePercent}% platform fee`}
        />
      </StatGrid>

      {/* Where the money comes from — the reason this page exists. */}
      <Panel
        title="Revenue concentration"
        subtitle="Gross takings by institution, this platform's lifetime"
        icon={PieChart}
        hue="sun"
      >
        <ConcentrationBar rows={portfolio.organisations} topShare={totals.topTenantShare} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Growth monthly={portfolio.monthly} />

        <Panel title="Seat utilisation" subtitle="Seats filled against seats sold" icon={Gauge} hue="blue">
          {totals.seatsSold > 0 ? (
            <div className="flex flex-col items-center">
              <SegmentedGauge
                value={seatShare}
                hue={seatShare >= 90 ? "sun" : "blue"}
                label="Seat utilisation"
                display={`${seatShare}%`}
                caption={`${totals.seatsUsed} of ${totals.seatsSold} sold seats are filled`}
              />
              <p className="mt-2 text-center text-xs text-neutral-500">
                {totals.unlimitedOrganisations > 0
                  ? `${totals.unlimitedOrganisations} institution${totals.unlimitedOrganisations === 1 ? " has" : "s have"} no cap and ${totals.unlimitedOrganisations === 1 ? "is" : "are"} not counted.`
                  : "Every institution has a seat cap."}
              </p>
            </div>
          ) : (
            <Empty icon={Ticket} title="No seat limits set" hint="Utilisation appears once an institution has a cap." />
          )}
        </Panel>
      </div>

      <Panel
        title="Needs a look"
        subtitle="Suspended, near a seat limit, or gone quiet for 30 days"
        icon={Siren}
        hue="coral"
      >
        <Attention items={portfolio.attention} />
      </Panel>

      <section aria-labelledby="portfolio-heading">
        <div className="mb-3">
          <h2 id="portfolio-heading" className="text-lg font-semibold text-neutral-900">
            Portfolio
          </h2>
          <p className="text-sm text-neutral-500">Figures match what each institution sees on its own dashboard</p>
        </div>
        <PortfolioView rows={portfolio.organisations} />
      </section>

      <p className="flex items-start gap-2 text-xs text-neutral-500">
        <Users size={13} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          Money, people and enrollments are counted against the institution the <em>learner</em> belongs to (the same
          rule the orders list uses), so an institution&rsquo;s figure here equals the one it sees itself. Courses are
          counted against whoever owns the catalog.
        </span>
      </p>
    </div>
  );
}
