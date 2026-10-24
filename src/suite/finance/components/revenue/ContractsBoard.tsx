"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Download, FilePlus2, FileSignature, Flag, Plus, ReceiptText, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { revenue, revenueError, type ContractSummary, type ContractsMeta } from "@/lib/api/finance-revenue-client";
import { Button, Card, Chip, Empty, PageHeader, SearchField, StatCard, StatGrid, buttonClass, cx } from "@/components/workspace/kit";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, compact, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { csvAmount, downloadCsv } from "@/components/workspace/csv";
import { BILLING_TYPES, pct } from "./meta";
import { BilledBar } from "./ui";

/**
 * The contract register: one card per project contract with what it is
 * worth, how much of it is invoiced, how far the milestones have got, and
 * the milestones accepted and waiting to be billed - each with "Invoice it",
 * which raises the draft and opens it. Below, the projects that have no
 * contract yet, each a link to set one up.
 */

interface Loaded {
  contracts: ContractSummary[];
  meta: ContractsMeta | null;
  projects: { id: string; name: string; code: string | null }[];
}

export default function ContractsBoard() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([revenue.contracts.list(), revenue.projects().catch(() => [])])
      .then(([c, projects]) => {
        if (!alive) return;
        setData({ contracts: c.contracts, meta: c.meta ?? null, projects });
        setError(null);
      })
      .catch((e: unknown) => alive && setError(revenueError(e, "The contracts didn't load.")));
    return () => {
      alive = false;
    };
  }, [reload]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.contracts ?? []).filter(
      (c) => !needle || `${c.title} ${c.reference ?? ""} ${c.client ?? ""} ${c.project?.name ?? ""} ${c.project?.code ?? ""}`.toLowerCase().includes(needle),
    );
  }, [data, q]);

  const uncovered = useMemo(() => {
    const covered = new Set((data?.contracts ?? []).map((c) => c.project?.id));
    const needle = q.trim().toLowerCase();
    return (data?.projects ?? []).filter((p) => !covered.has(p.id) && (!needle || `${p.name} ${p.code ?? ""}`.toLowerCase().includes(needle)));
  }, [data, q]);

  const totals = useMemo(() => {
    const cs = data?.contracts ?? [];
    return {
      value: cs.reduce((s, c) => s + c.value, 0),
      invoiced: cs.reduce((s, c) => s + c.invoiced, 0),
      settled: cs.reduce((s, c) => s + c.settled, 0),
      ready: cs.reduce((s, c) => s + c.readyToBill.reduce((t, m) => t + m.amount, 0), 0),
      readyCount: cs.reduce((s, c) => s + c.readyToBill.length, 0),
    };
  }, [data]);

  const canSave = mayDo(user, "contracts", "save");
  const canInvoice = mayDo(user, "contracts", "invoice_milestone");
  const billingLabel = (k: string) => data?.meta?.billingTypes?.[k as keyof ContractsMeta["billingTypes"]] ?? BILLING_TYPES[k as keyof typeof BILLING_TYPES] ?? k;

  /* As listed, after the search. Rates are percentages, as on screen. */
  const exportCsv = () =>
    downloadCsv("contracts.csv", [
      ["Contract", "Reference", "Client", "Project", "Billing", "Status", "Currency", "Value", "Invoiced", "Settled", "Retention", "Expected WHT", "VAT", "Payment terms (days)", "Milestones", "Milestones completed", "Ready to bill"],
      ...shown.map((c) => [
        c.title,
        c.reference ?? "",
        c.client ?? "",
        c.project ? [c.project.code, c.project.name].filter(Boolean).join(" ") : "",
        billingLabel(c.billingType),
        c.status.charAt(0).toUpperCase() + c.status.slice(1).replace(/_/g, " "),
        c.currency || "NGN",
        csvAmount(c.value),
        csvAmount(c.invoiced),
        csvAmount(c.settled),
        pct(c.retentionBp),
        pct(c.expectedWhtBp),
        c.vatApplicable ? pct(c.vatRateBp) : "No",
        c.paymentTermsDays,
        c.milestones.total,
        c.milestones.completed,
        csvAmount(c.readyToBill.reduce((t, m) => t + m.amount, 0)),
      ]),
    ]);

  const invoiceIt = async (milestoneId: string) => {
    setBusy(milestoneId);
    setActionError(null);
    try {
      const draft = await revenue.contracts.invoiceMilestone(milestoneId);
      router.push(`/suite/finance/revenue/invoices/${draft.id}?notice=drafted`);
    } catch (e) {
      setActionError(revenueError(e, "The invoice wasn't drafted."));
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Revenue"
        title="Contracts"
        subtitle="What each project is worth to its client, how much is billed, and the milestones ready to invoice."
        actions={
          canSave &&
          uncovered.length > 0 && (
            <Link href={`/suite/finance/revenue/contracts/${uncovered[0].id}`} className={buttonClass("primary")}>
              <Plus size={16} aria-hidden />
              Set up a contract
            </Link>
          )
        }
      />

      {error && <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />}
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      {!data ? (
        !error && (
          <div className="space-y-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-64" />
          </div>
        )
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard featured label="Under contract" value={compact(totals.value)} icon={FileSignature} hint={`${data.contracts.length} ${data.contracts.length === 1 ? "contract" : "contracts"}`} />
            <StatCard label="Invoiced" value={compact(totals.invoiced)} icon={ReceiptText} hue="sky" hint={totals.value ? `${Math.round((totals.invoiced / totals.value) * 100)}% of the value, before VAT` : undefined} />
            <StatCard label="Collected" value={compact(totals.settled)} icon={Wallet} hue="mint" hint="Settled on issued invoices, WHT included" />
            <StatCard
              label="Ready to bill"
              value={compact(totals.ready)}
              icon={Flag}
              hue={totals.readyCount ? "sun" : "slate"}
              hint={totals.readyCount ? `${totals.readyCount} accepted ${totals.readyCount === 1 ? "milestone" : "milestones"} to invoice` : "Nothing waiting"}
            />
          </StatGrid>

          <div className="mb-4 mt-6 flex flex-wrap items-center gap-3">
            <SearchField value={q} onChange={setQ} placeholder="Search contract, client or project" label="Search contracts" className="w-full sm:w-80" />
            <p className="ml-auto text-sm text-neutral-600" aria-live="polite">
              <span className="font-semibold tabular-nums text-neutral-900">{shown.length}</span> {shown.length === 1 ? "contract" : "contracts"}
            </p>
            <Button size="sm" icon={Download} onClick={exportCsv} disabled={shown.length === 0}>
              Download CSV
            </Button>
          </div>

          {shown.length === 0 ? (
            <Card className="mb-6">
              <Empty
                icon={FileSignature}
                title={q ? "No contracts match" : "No contracts yet"}
                hint={
                  q
                    ? "Try another word, or clear the search."
                    : "A contract says what a project is worth to its client and how it is billed. Set one up for a project below to start invoicing it."
                }
              />
            </Card>
          ) : (
            <ul className="mb-8 grid gap-4 lg:grid-cols-2">
              {shown.map((c) => (
                <ContractCard key={c.id} c={c} billingLabel={billingLabel(c.billingType)} canInvoice={canInvoice} busy={busy} onInvoice={invoiceIt} />
              ))}
            </ul>
          )}

          <section aria-labelledby="no-contract">
            <h2 id="no-contract" className="text-base font-bold tracking-tight text-neutral-900">
              Projects with no contract
            </h2>
            <p className="mt-1 text-sm text-neutral-500">Their work can&apos;t be billed from a milestone until a contract says what it is worth.</p>
            {uncovered.length === 0 ? (
              <p className="mt-3 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700">Every project{q ? " that matches" : ""} has a contract.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {uncovered.map((p) => (
                  <li key={p.id}>
                    {canSave ? (
                      <Link
                        href={`/suite/finance/revenue/contracts/${p.id}`}
                        className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition hover:border-primary-400 hover:bg-primary-50/40 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-neutral-900">{p.name}</span>
                          {p.code && <span className="font-mono text-xs text-neutral-500">{p.code}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-700">
                          <FilePlus2 size={14} aria-hidden />
                          Set up a contract
                        </span>
                      </Link>
                    ) : (
                      <span className="flex min-h-14 items-center rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700">{p.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ContractCard({
  c,
  billingLabel,
  canInvoice,
  busy,
  onInvoice,
}: {
  c: ContractSummary;
  billingLabel: string;
  canInvoice: boolean;
  busy: string | null;
  onInvoice: (milestoneId: string) => void;
}) {
  const cur = c.currency as CurrencyCode;
  const m = c.milestones;
  return (
    <li className="ws-card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {c.project?.code && <span className="font-mono">{c.project.code} · </span>}
            {c.project?.name ?? "No project"}
          </p>
          <h3 className="mt-1 text-base font-bold tracking-tight leading-snug text-neutral-900">
            <Link href={`/suite/finance/revenue/contracts/${c.project?.id ?? ""}`} className="outline-none hover:text-primary-700 hover:underline focus-visible:underline">
              {c.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            {c.clientId ? (
              <Link href={`/suite/finance/revenue/clients/${c.clientId}`} className="hover:text-primary-700 hover:underline">
                {c.client}
              </Link>
            ) : (
              c.client
            )}
            {c.reference && <span className="ml-1.5 font-mono text-xs text-neutral-500">{c.reference}</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tabular-nums text-neutral-900">{amount(c.value, cur)}</p>
          <p className="text-xs text-neutral-500">before VAT</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip hue="sky">{billingLabel}</Chip>
        {c.retentionBp > 0 && <Chip hue="grape">{pct(c.retentionBp)} retention</Chip>}
        {c.expectedWhtBp > 0 && <Chip hue="slate">{pct(c.expectedWhtBp)} WHT expected</Chip>}
        {c.status !== "active" && <Chip hue="slate">{c.status}</Chip>}
      </div>

      <div className="mt-4">
        <BilledBar invoiced={c.invoiced} value={c.value} currency={c.currency} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Milestones</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-900">
            {m.invoiced + m.completed} of {m.total} <span className="font-normal text-neutral-500">done</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Collected</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-900">{amount(c.settled, cur)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Still to collect</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-900">{amount(Math.max(0, c.billedTotal - c.settled), cur)}</dd>
        </div>
      </dl>

      {c.readyToBill.length > 0 && (
        <div className="mt-4 rounded-xl bg-mint-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-mint-700">Ready to bill</p>
          <ul className="mt-2 space-y-2">
            {c.readyToBill.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-sm text-neutral-900">
                  {r.name} <span className="ml-1 font-semibold tabular-nums">{amount(r.amount, cur)}</span>
                  {r.dueOn && <span className="ml-1.5 text-xs text-neutral-500">due {day(r.dueOn)}</span>}
                </span>
                {canInvoice && (
                  <Button size="sm" icon={ReceiptText} disabled={busy !== null} onClick={() => onInvoice(r.id)}>
                    {busy === r.id ? "Drafting…" : "Invoice it"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-4">
        <Link
          href={`/suite/finance/revenue/contracts/${c.project?.id ?? ""}`}
          className={cx("inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline")}
        >
          Open the contract <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </li>
  );
}
