"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Banknote, CalendarPlus, Download, FileStack, Layers, Send, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { banking, type BankAccount, type BankCode } from "@/lib/api/finance-banking-client";
import { plainError, spend, type PaymentSchedule, type VoucherSummary } from "@/lib/api/finance-payments-client";
import { Button, Card, Chip, Empty, PageHeader, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, compact, day } from "@/suite/finance/lib/format";
import { BankMark } from "../banking/ui";
import { PvNumber } from "../vouchers/ui";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { VOUCHER_STATUS } from "../vouchers/meta";
import { SCHEDULE_STATUS } from "./meta";

/**
 * Treasury's desk. Approved vouchers wait here, grouped by the account they
 * are paid from - one schedule per paying account - and become a schedule
 * by ticking them. A second person approves the schedule before its bank
 * file can be downloaded; the schedules list says where each one is.
 */

type Tab = "queue" | "schedules";

interface Group {
  bankId: string;
  name: string;
  bank: BankAccount | null;
  vouchers: VoucherSummary[];
  total: number;
}

export default function PaymentsBoard() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(params?.get("tab") === "schedules" ? "schedules" : "queue");
  const [queue, setQueue] = useState<VoucherSummary[] | null>(null);
  const [scheduled, setScheduled] = useState<VoucherSummary[]>([]);
  const [schedules, setSchedules] = useState<PaymentSchedule[] | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      spend.vouchers.list({ status: "approved" }),
      spend.schedules.list(),
      spend.vouchers.list({ status: "scheduled" }).catch(() => [] as VoucherSummary[]),
      banking.accounts.list().catch(() => [] as BankAccount[]),
    ]).then(
      ([q, s, sc, b]) => {
        if (!alive) return;
        setQueue(q);
        setSchedules(s);
        setScheduled(sc);
        setBanks(b);
        setError(null);
      },
      (e: unknown) => alive && setError(plainError(e, "Payments didn't load.")),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const groups = useMemo<Group[]>(() => {
    const byBank = new Map<string, Group>();
    for (const v of queue ?? []) {
      const k = v.payingBankAccountId ?? "";
      const g = byBank.get(k) ?? { bankId: k, name: v.payingBankAccount ?? "No paying account", bank: banks.find((b) => b.id === k) ?? null, vouchers: [], total: 0 };
      g.vouchers.push(v);
      g.total += v.net;
      byBank.set(k, g);
    }
    return [...byBank.values()].sort((a, b) => b.total - a.total);
  }, [queue, banks]);

  const toPay = (queue ?? []).reduce((s, v) => s + v.net, 0);
  const awaitingApproval = (schedules ?? []).filter((s) => s.status === "draft");
  const awaitingRefs = scheduled.length;

  const columns: Column<PaymentSchedule>[] = [
    {
      key: "ref",
      header: "Schedule",
      primary: true,
      sortable: true,
      value: (s) => s.reference,
      render: (s) => (
        <span className="block">
          <PvNumber value={s.reference} />
          <span className="mt-0.5 block text-xs text-neutral-500">{s.createdAt ? day(s.createdAt) : ""}</span>
        </span>
      ),
    },
    { key: "bank", header: "Paid from", sortable: true, value: (s) => s.bankAccount ?? "", render: (s) => <span className="text-neutral-700">{s.bankAccount ?? "-"}</span> },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (s) => SCHEDULE_STATUS[s.status]?.label,
      render: (s) => {
        const m = SCHEDULE_STATUS[s.status] ?? SCHEDULE_STATUS.draft;
        return (
          <Chip hue={m.hue} icon={m.icon}>
            {m.label}
          </Chip>
        );
      },
    },
    { key: "count", header: "Vouchers", align: "right", hideOnMobile: true, value: (s) => s.count, render: (s) => <span className="tabular-nums text-neutral-700">{s.count}</span> },
    {
      key: "people",
      header: "Built / approved by",
      hideOnMobile: true,
      tableOnly: true,
      value: (s) => s.createdBy ?? "",
      render: (s) => (
        <span className="text-neutral-600">
          {s.createdBy ?? "-"} / {s.approvedBy ?? <span className="text-neutral-500">not yet</span>}
        </span>
      ),
    },
    { key: "total", header: "Total", align: "right", sortable: true, value: (s) => s.total, render: (s) => <span className="whitespace-nowrap font-semibold tabular-nums text-neutral-900">{amount(s.total)}</span> },
  ];

  const loaded = queue !== null && schedules !== null;
  const currencyOf = (bankId: string | null) => banks.find((b) => b.id === bankId)?.currency || "NGN";

  /* To pay: every approved voucher, by paying account as grouped on screen. */
  const exportQueue = () =>
    downloadCsv("payments-to-pay.csv", [
      ["Paid from", "Voucher", "Date", "Payee", "Narration", "Status", "Currency", "Net payable"],
      ...groups.flatMap((g) =>
        g.vouchers.map((v) => [g.name, v.pvNo, csvDate(v.date), v.payee, v.narration ?? "", VOUCHER_STATUS[v.status]?.label ?? v.status, v.currency || "NGN", csvAmount(v.net)]),
      ),
    ]);

  /* Schedules: as listed, after the search and the sort. */
  const exportSchedules = (rows: PaymentSchedule[]) =>
    downloadCsv("payment-schedules.csv", [
      ["Schedule", "Created", "Paid from", "Status", "Vouchers", "Currency", "Total", "Built by", "Approved by", "Approved at", "Bank file produced"],
      ...rows.map((s) => [
        s.reference,
        csvDate(s.createdAt),
        s.bankAccount ?? "",
        SCHEDULE_STATUS[s.status]?.label ?? s.status,
        s.count,
        currencyOf(s.bankAccountId),
        csvAmount(s.total),
        s.createdBy ?? "",
        s.approvedBy ?? "",
        csvDate(s.approvedAt),
        csvDate(s.generatedAt),
      ]),
    ]);

  return (
    <div>
      <PageHeader
        eyebrow="Spend to pay"
        title="Payments"
        subtitle="Approved vouchers become a payment schedule per paying account. A second person approves it; then the bank file is downloaded and each bank reference recorded."
        tabs={[
          { key: "queue", label: "To pay", count: queue?.length },
          { key: "schedules", label: "Schedules", count: schedules?.length },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
        actions={
          tab === "queue" &&
          loaded && (
            <Button icon={Download} onClick={exportQueue} disabled={groups.length === 0}>
              Download CSV
            </Button>
          )
        }
      />

      {error && <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />}

      {!loaded ? (
        !error && <Skeleton className="h-96" />
      ) : (
        <>
          <div className="mb-6">
            <StatGrid cols={4}>
              <StatCard label="Approved, to pay" value={compact(toPay)} icon={Wallet} hue="blue" hint={`${queue!.length} ${queue!.length === 1 ? "voucher" : "vouchers"}`} />
              <StatCard label="Paying accounts" value={groups.length} icon={Banknote} hue="sky" hint="One schedule each" />
              <StatCard label="Schedules to approve" value={awaitingApproval.length} icon={Layers} hue="grape" hint={awaitingApproval.length ? compact(awaitingApproval.reduce((s, x) => s + x.total, 0)) : "None waiting"} />
              <StatCard label="Waiting for a bank reference" value={awaitingRefs} icon={Send} hue="sun" hint="On a schedule, not yet sent" />
            </StatGrid>
          </div>

          {tab === "queue" ? (
            groups.length === 0 ? (
              <Card>
                <Empty icon={FileStack} title="Nothing waiting to be paid" hint="Vouchers appear here once they are approved. Scheduled ones are under Schedules." />
              </Card>
            ) : (
              <div className="space-y-6">
                {groups.map((g) => (
                  <QueueGroup
                    key={g.bankId || "none"}
                    group={g}
                    canBuild={mayDo(user, "payments", "create")}
                    onBuilt={(id) => router.push(`/suite/finance/payments/${id}?notice=built`)}
                  />
                ))}
              </div>
            )
          ) : (
            <DataView
              rows={schedules!}
              columns={columns}
              rowKey={(s) => s.id}
              rowHref={(s) => `/suite/finance/payments/${s.id}`}
              storageKey="finance-payment-schedules"
              views={["table", "list"]}
              searchPlaceholder="Search schedules"
              caption="Payment schedules"
              onDownload={exportSchedules}
              empty={<Empty icon={Layers} title="No schedules yet" hint="Build one from the vouchers under To pay." />}
            />
          )}
        </>
      )}
    </div>
  );
}

function QueueGroup({ group: g, canBuild, onBuilt }: { group: Group; canBuild: boolean; onBuilt: (id: string) => void }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(g.vouchers.map((v) => v.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = g.vouchers.filter((v) => picked.has(v.id));
  const total = chosen.reduce((s, v) => s + v.net, 0);
  const all = chosen.length === g.vouchers.length;
  const short = g.bank != null && g.bank.bookBalance < total;
  const headId = `grp-${g.bankId || "none"}`;

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await spend.schedules.create(g.bankId, chosen.map((v) => v.id));
      onBuilt(s.id);
    } catch (e) {
      setError(plainError(e, "The schedule wasn't built."));
      setBusy(false);
    }
  };

  return (
    <Card as="section" className="overflow-hidden">
      <header className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {g.bank ? <BankMark code={g.bank.bankCode as BankCode} /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500"><Banknote size={18} aria-hidden /></span>}
          <div className="min-w-0">
            <h2 id={headId} className="truncate text-base font-bold tracking-tight text-neutral-900">
              {g.name}
            </h2>
            <p className="text-xs text-neutral-500">
              {g.bank ? (
                <>
                  {g.bank.bankName} {g.bank.number} · book balance <span className="tabular-nums">{amount(g.bank.bookBalance)}</span>
                </>
              ) : (
                `${g.vouchers.length} approved ${g.vouchers.length === 1 ? "voucher" : "vouchers"}`
              )}
            </p>
          </div>
        </div>
        <p className="text-right text-sm text-neutral-600">
          <span className="block text-xs text-neutral-500">Waiting</span>
          <span className="text-lg font-bold tabular-nums text-neutral-900">{amount(g.total)}</span>
        </p>
      </header>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" aria-labelledby={headId}>
          <thead>
            <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th scope="col" className="w-12 py-2.5 pl-5 pr-2">
                <input
                  type="checkbox"
                  checked={all}
                  aria-label={all ? "Untick every voucher" : "Tick every voucher"}
                  onChange={() => setPicked(all ? new Set() : new Set(g.vouchers.map((v) => v.id)))}
                  className="h-4 w-4 cursor-pointer accent-primary-600"
                />
              </th>
              <th scope="col" className="px-2 py-2.5">Voucher</th>
              <th scope="col" className="px-2 py-2.5">Payee</th>
              <th scope="col" className="px-2 py-2.5">Beneficiary account</th>
              <th scope="col" className="py-2.5 pl-2 pr-5 text-right">Net payable</th>
            </tr>
          </thead>
          <tbody>
            {g.vouchers.map((v) => (
              <tr key={v.id} className={cx("border-b border-neutral-100 last:border-b-0", picked.has(v.id) && "bg-primary-50/40")}>
                <td className="py-3 pl-5 pr-2">
                  <input
                    type="checkbox"
                    checked={picked.has(v.id)}
                    onChange={() => toggle(v.id)}
                    aria-label={`Include ${v.pvNo}, ${v.payee}`}
                    className="h-4 w-4 cursor-pointer accent-primary-600"
                  />
                </td>
                <td className="px-2 py-3">
                  <Link href={`/suite/finance/vouchers/${v.id}`} className="hover:underline">
                    <PvNumber value={v.pvNo} />
                  </Link>
                </td>
                <td className="px-2 py-3">
                  <span className="font-medium text-neutral-900">{v.payee}</span>
                  {v.narration && <span className="block max-w-xs truncate text-xs text-neutral-500">{v.narration}</span>}
                </td>
                <td className="px-2 py-3 text-neutral-600">
                  {v.payeeBank ? (
                    <>
                      {v.payeeBank.bankName} <span className="font-mono text-xs">•••• {v.payeeBank.last4}</span>
                    </>
                  ) : (
                    <span className="text-sun-700">None on record</span>
                  )}
                </td>
                <td className="py-3 pl-2 pr-5 text-right font-semibold tabular-nums text-neutral-900">{amount(v.net, v.currency as "NGN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm" aria-live="polite">
          <span className="text-neutral-600">
            {chosen.length} of {g.vouchers.length} ticked ·{" "}
          </span>
          <span className="font-bold tabular-nums text-neutral-900">{amount(total)}</span>
          {short && (
            <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-sun-700">
              <AlertTriangle size={13} aria-hidden />
              More than the account&apos;s book balance of {amount(g.bank!.bookBalance)}.
            </span>
          )}
        </div>
        {canBuild && g.bankId && (
          <Button variant="primary" icon={CalendarPlus} onClick={build} disabled={busy || chosen.length === 0}>
            {busy ? "Building…" : `Build schedule${chosen.length ? ` of ${chosen.length}` : ""}`}
          </Button>
        )}
      </footer>
      {error && <ErrorNote className="mx-5 mb-5">{error}</ErrorNote>}
    </Card>
  );
}
