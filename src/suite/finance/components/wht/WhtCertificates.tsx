"use client";

import { useEffect, useState } from "react";
import { FileBadge2, FileDown, TriangleAlert } from "lucide-react";
import { Card, Chip, Empty, buttonClass, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { csvAmount, downloadCsv } from "@/components/workspace/csv";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { monthLabel } from "@/suite/finance/lib/format";
import { errorText, splitPeriod, wht, type WhtCertificateSupplier } from "@/lib/api/finance-wht-client";

/**
 * Each supplier WHT was withheld from in a year: the total, the months it
 * fell in (remitted or not), and the certificate for the year or any one
 * month. A month not yet remitted still gets a certificate, marked so.
 */
export function WhtCertificates({ year }: { year: number }) {
  const [rows, setRows] = useState<WhtCertificateSupplier[] | null>(null);
  const [currency, setCurrency] = useState("NGN");
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setRows(null);
    wht.certificates(year).then(
      (d) => {
        if (!alive) return;
        setRows(d.suppliers);
        setCurrency(d.currency);
        setError(null);
      },
      (e: unknown) => alive && setError(`Supplier certificates didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [year, reload]);

  if (error && !rows) return <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!rows)
    return (
      <div aria-busy="true">
        <p className="sr-only">Loading supplier certificates…</p>
        <Skeleton className="h-80" />
      </div>
    );

  if (rows.length === 0)
    return (
      <Card>
        <Empty icon={FileBadge2} title={`No WHT withheld from suppliers in ${year}`} hint="Certificates appear here for each supplier once a voucher with WHT is approved." />
      </Card>
    );

  const columns: Column<WhtCertificateSupplier>[] = [
    {
      key: "name",
      header: "Supplier",
      primary: true,
      sortable: true,
      value: (s) => s.name,
      render: (s) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-neutral-900">{s.name}</span>
          <span className="block text-xs text-neutral-500">
            {s.tin ? (
              <>
                TIN <span className="font-mono">{s.tin}</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-sun-700">
                <TriangleAlert size={12} aria-hidden /> No TIN on record
              </span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: "months",
      header: "Months",
      render: (s) => (
        <span className="flex flex-wrap gap-1.5">
          {s.months.map((m) => {
            const [y, mo] = splitPeriod(m.period);
            return (
              <a
                key={m.period}
                href={wht.certificateUrl(s.counterpartyId, y, mo)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={m.remitted ? "Remitted" : m.raised ? "Raised, awaiting payment" : "Not yet remitted"}
                aria-label={`${s.name}: certificate for ${monthLabel(m.period)} (${m.remitted ? "remitted" : "not yet remitted"})`}
                className={cx(
                  "inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                  m.remitted ? "bg-mint-50 text-mint-700 hover:bg-mint-100" : "bg-sun-50 text-sun-700 hover:bg-sun-100",
                )}
              >
                {monthLabel(m.period, true).split(" ")[0]}
                <span className="sr-only">{m.remitted ? " remitted" : " not remitted"}</span>
                {!m.remitted && <span aria-hidden>·</span>}
                {!m.remitted && <span aria-hidden>{m.raised ? "raised" : "open"}</span>}
              </a>
            );
          })}
        </span>
      ),
    },
    { key: "lines", header: "Transactions", align: "right", sortable: true, hideOnMobile: true, value: (s) => s.lineCount },
    { key: "gross", header: "Gross", align: "right", sortable: true, hideOnMobile: true, value: (s) => s.gross, render: (s) => <Money value={s.gross} currency={currency} className="text-neutral-600" /> },
    { key: "wht", header: "WHT", align: "right", sortable: true, value: (s) => s.wht, render: (s) => <Money value={s.wht} currency={currency} className="font-semibold text-neutral-900" /> },
    {
      key: "pdf",
      header: "Certificate",
      tableOnly: true,
      render: (s) => (
        <a
          href={wht.certificateUrl(s.counterpartyId, year)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={buttonClass("secondary", "sm")}
          aria-label={`${s.name}: certificate PDF for ${year}`}
        >
          <FileDown size={15} aria-hidden /> {year} PDF
        </a>
      ),
    },
  ];

  const remitted = rows.every((s) => s.months.every((m) => m.remitted));

  return (
    <section aria-labelledby="wht-certs" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="wht-certs" className="text-[15px] font-semibold text-neutral-900">
          Suppliers, {year}
        </h2>
        {!remitted && (
          <Chip hue="sun" icon={TriangleAlert}>
            Some months are not yet remitted; their certificates say so
          </Chip>
        )}
      </div>
      <DataView
        rows={rows}
        columns={columns}
        rowKey={(s) => s.counterpartyId}
        views={["table", "list"]}
        storageKey="finance.wht.certificates"
        caption={`WHT withheld by supplier, ${year}`}
        searchPlaceholder="Search suppliers"
        onDownload={(list) =>
          downloadCsv(`wht-suppliers-${year}.csv`, [
            ["Supplier", "TIN", "Year", "Transactions", "Currency", "Gross", "WHT", "Months not remitted"],
            ...list.map((s) => [s.name, s.tin ?? "", year, s.lineCount, currency, csvAmount(s.gross), csvAmount(s.wht), s.months.filter((m) => !m.remitted).map((m) => m.period).join(" ")]),
          ])
        }
      />
    </section>
  );
}
