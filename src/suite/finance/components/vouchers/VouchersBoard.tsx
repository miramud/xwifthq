"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileStack, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { banking, type BankAccount } from "@/lib/api/finance-banking-client";
import { plainError, spend, type VoucherStatus, type VoucherSummary } from "@/lib/api/finance-payments-client";
import { Button, ButtonLink, Chip, Empty, PageHeader, SearchField, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, day } from "@/suite/finance/lib/format";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { KIND_LABEL, VOUCHER_STATUS, VOUCHER_TABS } from "./meta";
import { PvNumber, VoucherStatusChip } from "./ui";

/**
 * The payment voucher register: every voucher by number, newest first. The
 * numbers run without gaps (a cancelled voucher keeps its number), so the
 * number leads each row. Tabs follow the money from draft to confirmed.
 */

type Tab = "all" | VoucherStatus;
const isTab = (v: string | null): v is Tab => VOUCHER_TABS.some((t) => t.key === v);

export default function VouchersBoard() {
  const params = useSearchParams();
  const { user } = useAuth();
  const initial = params?.get("status") ?? null;
  const [tab, setTab] = useState<Tab>(isTab(initial) ? initial : "all");
  const [q, setQ] = useState("");
  const [bank, setBank] = useState(params?.get("bankAccountId") ?? "");
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [result, setResult] = useState<{ key: string; rows: VoucherSummary[] | null; error: string | null }>({ key: "", rows: null, error: null });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    banking.accounts.list().then(setBanks, () => setBanks([]));
  }, []);

  const key = `${bank}|${reload}`;
  useEffect(() => {
    let alive = true;
    spend.vouchers
      .list({ bankAccountId: bank || undefined })
      .then((rows) => alive && setResult({ key, rows, error: null }))
      .catch((e: unknown) => alive && setResult((r) => ({ key, rows: r.rows, error: plainError(e, "Vouchers didn't load.") })));
    return () => {
      alive = false;
    };
    // `key` carries the filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = result.key !== key;
  const all = useMemo(() => result.rows ?? [], [result.rows]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((v) => m.set(v.status, (m.get(v.status) ?? 0) + 1));
    return m;
  }, [all]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (v) => (tab === "all" || v.status === tab) && (!needle || `${v.pvNo} ${v.payee} ${v.narration ?? ""} ${v.cibReference ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [all, tab, q]);
  const total = shown.reduce((s, v) => s + v.net, 0);
  const filtered = Boolean(q || bank);

  /* The tab, the bank account and the search, as listed. */
  const exportCsv = (rows: VoucherSummary[]) =>
    downloadCsv(`vouchers${tab === "all" ? "" : `_${tab}`}.csv`, [
      ["Voucher", "Date", "Kind", "Payee", "Payee type", "Narration", "Paid from", "Status", "Currency", "Gross", "VAT", "WHT", "Net payable", "Bank reference", "Prepared by", "Confirmed at"],
      ...rows.map((v) => [
        v.pvNo,
        csvDate(v.date),
        KIND_LABEL[v.kind] ?? v.kind,
        v.payee,
        v.payeeKind === "staff" ? "Staff" : "Vendor",
        v.narration ?? "",
        v.payingBankAccount ?? "",
        VOUCHER_STATUS[v.status]?.label ?? v.status,
        v.currency || "NGN",
        csvAmount(v.gross),
        csvAmount(v.vat),
        csvAmount(v.wht),
        csvAmount(v.net),
        v.cibReference ?? "",
        v.preparedBy ?? "",
        csvDate(v.confirmedAt),
      ]),
    ]);

  const columns: Column<VoucherSummary>[] = [
    {
      key: "pv",
      header: "Voucher",
      sortable: true,
      value: (v) => v.pvNo,
      render: (v) => (
        <span className="block">
          <PvNumber value={v.pvNo} />
          <span className="mt-0.5 block text-xs text-neutral-500">{day(v.date)}</span>
        </span>
      ),
    },
    {
      key: "payee",
      header: "Payee",
      primary: true,
      sortable: true,
      value: (v) => v.payee,
      render: (v) => (
        <span className="block min-w-[12rem] max-w-sm">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-neutral-900">{v.payee}</span>
            {v.kind === "advance" && <Chip hue="grape">{KIND_LABEL.advance}</Chip>}
          </span>
          {v.narration && <span className="mt-0.5 line-clamp-1 block text-xs text-neutral-500">{v.narration}</span>}
        </span>
      ),
    },
    {
      key: "account",
      header: "Paid from",
      hideOnMobile: true,
      value: (v) => v.payingBankAccount ?? "",
      render: (v) => <span className="whitespace-nowrap text-neutral-600">{v.payingBankAccount ?? <span className="text-neutral-500">Not chosen</span>}</span>,
    },
    { key: "status", header: "Status", sortable: true, value: (v) => VOUCHER_STATUS[v.status]?.label, render: (v) => <VoucherStatusChip status={v.status} /> },
    {
      key: "wht",
      header: "WHT",
      align: "right",
      hideOnMobile: true,
      tableOnly: true,
      value: (v) => v.wht,
      render: (v) => <span className="whitespace-nowrap tabular-nums text-neutral-600">{v.wht ? amount(v.wht) : "–"}</span>,
    },
    {
      key: "net",
      header: "Net payable",
      align: "right",
      sortable: true,
      value: (v) => v.net,
      render: (v) => <span className="whitespace-nowrap font-semibold tabular-nums text-neutral-900">{amount(v.net, v.currency as "NGN")}</span>,
    },
  ];

  const tabs = VOUCHER_TABS.map((t) => ({ key: t.key, label: t.label, count: t.key === "all" ? all.length : counts.get(t.key) }));

  return (
    <div>
      <PageHeader
        eyebrow="Spend to pay"
        title="Payment vouchers"
        subtitle="Every voucher by number. A voucher is prepared from a request the FCU has cleared, checked again, authorised, then paid."
        actions={
          mayDo(user, "vouchers", "create") && (
            <ButtonLink href="/suite/finance/memos?status=fcu_cleared" variant="primary" icon={Plus}>
              Prepare a voucher
            </ButtonLink>
          )
        }
        tabs={result.rows ? tabs : VOUCHER_TABS}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <div className="ws-card mb-4 flex flex-wrap items-end gap-3 p-4">
        <SearchField value={q} onChange={setQ} placeholder="Search number, payee or bank reference" label="Search vouchers" className="w-full sm:w-80" />
        <div className="w-full sm:w-64">
          <span id="pv-bank-label" className="mb-1.5 block text-xs font-medium text-neutral-600">
            Paid from
          </span>
          <SearchableSelect
            aria-labelledby="pv-bank-label"
            value={bank}
            onChange={setBank}
            options={[{ value: "", label: "Every bank account" }, ...banks.map((b) => ({ value: b.id, label: b.name, hint: `${b.bankName ?? ""} ${b.number}`.trim() }))]}
            searchPlaceholder="Search bank accounts"
          />
        </div>
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            onClick={() => {
              setQ("");
              setBank("");
            }}
          >
            Clear filters
          </Button>
        )}
        <p className="ml-auto text-right text-sm text-neutral-600" aria-live="polite">
          {result.rows && (
            <>
              <span className="font-semibold tabular-nums text-neutral-900">{shown.length}</span> {shown.length === 1 ? "voucher" : "vouchers"} ·{" "}
              <span className="font-semibold tabular-nums text-neutral-900">{amount(total)}</span> net
              {all.length >= 500 && <span className="block text-xs text-neutral-500">Showing the latest 500.</span>}
            </>
          )}
        </p>
      </div>

      {result.error && <LoadError text={result.error} onRetry={() => setReload((n) => n + 1)} />}

      {result.rows === null ? (
        !result.error && <Skeleton className="h-80" />
      ) : (
        <div className={cx("transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <DataView
            rows={shown}
            columns={columns}
            rowKey={(v) => v.id}
            rowHref={(v) => `/suite/finance/vouchers/${v.id}`}
            storageKey="finance-vouchers"
            views={["table", "list"]}
            searchable={false}
            caption="Payment vouchers"
            onDownload={exportCsv}
            empty={
              <Empty
                icon={FileStack}
                title={filtered || tab !== "all" ? "No vouchers match" : "No vouchers yet"}
                hint={
                  filtered || tab !== "all"
                    ? "Try another tab or clear the filters."
                    : "Vouchers are prepared from requests the FCU has cleared. Open a cleared request to prepare the first one."
                }
                action={
                  !filtered &&
                  tab === "all" &&
                  mayDo(user, "vouchers", "create") && (
                    <ButtonLink href="/suite/finance/memos?status=fcu_cleared" variant="primary" icon={Plus}>
                      See cleared requests
                    </ButtonLink>
                  )
                }
              />
            }
          />
        </div>
      )}
    </div>
  );
}
