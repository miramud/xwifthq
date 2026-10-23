"use client";

import { useId, useMemo, useState } from "react";
import { Download, Link2, X } from "lucide-react";
import { Button, Chip, SearchField, cx } from "@/components/workspace/kit";
import { selectClass } from "@/suite/lms/components/ui/ws";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { day } from "@/suite/finance/lib/format";
import type { CrRequest } from "@/lib/api/finance-company-report-client";
import { Table, money } from "./parts";

/*
  Every request raised in the period, whoever raised it - the register the
  owner asked for "down to the personnel that raised requisitions". A row
  that belongs to another request (its money is counted there) or that the
  API leaves out of the totals is still listed, but says so and is not added.
*/

const counted = (r: CrRequest) => r.inTotals && !r.partOf;

export default function RequestsLedger({ requests, currency, period }: { requests: CrRequest[]; currency: string; period: string }) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [register, setRegister] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");

  const options = useMemo(() => {
    const regs = new Map<string, string>();
    const deps = new Set<string>();
    const sts = new Map<string, string>();
    for (const r of requests) {
      regs.set(r.register, r.registerLabel);
      if (r.department) deps.add(r.department);
      sts.set(r.status, r.statusLabel);
    }
    const byLabel = (a: [string, string], b: [string, string]) => a[1].localeCompare(b[1]);
    return { regs: [...regs].sort(byLabel), deps: [...deps].sort(), sts: [...sts].sort(byLabel) };
  }, [requests]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return requests.filter((r) => {
      if (register && r.register !== register) return false;
      if (department && r.department !== department) return false;
      if (status && r.status !== status) return false;
      if (!needle) return true;
      return [r.reference, r.title, r.requester, r.department, r.project, r.costCentre, r.category, r.registerLabel, r.statusLabel]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle));
    });
  }, [requests, q, register, department, status]);

  const sum = (k: "estimated" | "approved" | "actual") =>
    rows.filter((r) => counted(r) && (!r.currency || r.currency === currency)).reduce((s, r) => s + (r[k] ?? 0), 0);
  const filtered = Boolean(q || register || department || status);
  const left = rows.filter((r) => !counted(r)).length;

  const download = () => {
    const out: (string | number | boolean | null)[][] = [
      ["Reference", "Title", "Register", "Raised by", "Department", "Raised on", "Project", "Cost centre", "Category", "Status", "Currency", "Estimated", "Approved", "Actual", "Live", "Part of", "Counted in totals", "Note"],
    ];
    for (const r of rows) {
      out.push([
        r.reference ?? "",
        r.title,
        r.registerLabel,
        r.requester ?? "",
        r.department ?? "",
        csvDate(r.raisedOn),
        r.project ?? "",
        r.costCentre ?? "",
        r.category ?? "",
        r.statusLabel,
        r.currency ?? currency,
        csvAmount(r.estimated),
        csvAmount(r.approved),
        csvAmount(r.actual),
        r.live ? "yes" : "no",
        r.partOf ?? "",
        counted(r) ? "yes" : "no",
        r.note ?? "",
      ]);
    }
    downloadCsv(csvName("requests", period), out);
  };

  const amountCell = (r: CrRequest, v: number | null) =>
    v === null ? (
      <span className="text-neutral-400">—</span>
    ) : (
      <span className={cx(!counted(r) && "text-neutral-500")}>
        {money(v)}
        {r.currency && r.currency !== currency && <span className="ml-1 text-[11px] text-neutral-500">{r.currency}</span>}
      </span>
    );

  return (
    <div>
      <div className="mb-4 grid gap-3 print:hidden sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1.4fr)_repeat(3,minmax(9rem,1fr))_auto]">
        <SearchField value={q} onChange={setQ} placeholder="Search reference, title, person, project" label="Search requests" className="sm:col-span-2 xl:col-span-1" />
        <label htmlFor={`${uid}-reg`} className="block">
          <span className="sr-only">Register</span>
          <select id={`${uid}-reg`} className={selectClass} value={register} onChange={(e) => setRegister(e.target.value)}>
            <option value="">Every register</option>
            {options.regs.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${uid}-dep`} className="block">
          <span className="sr-only">Department</span>
          <select id={`${uid}-dep`} className={selectClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Every department</option>
            {options.deps.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${uid}-st`} className="block">
          <span className="sr-only">Status</span>
          <select id={`${uid}-st`} className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Every status</option>
            {options.sts.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
          {filtered && (
            <Button
              variant="ghost"
              icon={X}
              onClick={() => {
                setQ("");
                setRegister("");
                setDepartment("");
                setStatus("");
              }}
            >
              Clear
            </Button>
          )}
          <Button icon={Download} onClick={download} disabled={rows.length === 0}>
            Download CSV
          </Button>
        </div>
      </div>

      <p className="mb-3 text-xs text-neutral-500" aria-live="polite">
        {rows.length === requests.length ? `${requests.length} requests` : `${rows.length} of ${requests.length} requests`}
        {left > 0 && ` · ${left} shown but not counted in totals (part of another request, or excluded)`}
      </p>

      <Table
        caption="Every request raised in the period"
        rows={rows}
        rowKey={(r) => `${r.register}-${r.id}`}
        limit={25}
        empty={filtered ? "No request matches these filters." : "Nobody raised a request in this period."}
        rowClass={(r) => (counted(r) ? undefined : "bg-neutral-50/80")}
        cols={[
          {
            label: "Request",
            className: "min-w-[15rem]",
            cell: (r) => (
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{r.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                  {r.reference && <span className="font-mono">{r.reference}</span>}
                  <span>{r.registerLabel}</span>
                  {r.category && <span>· {r.category}</span>}
                </p>
                {!counted(r) && (
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Chip hue="slate" icon={Link2}>
                      Not counted in totals
                    </Chip>
                    <span className="text-xs text-neutral-500">{r.partOf ? `Part of ${r.partOf}` : r.note}</span>
                  </p>
                )}
                {counted(r) && r.note && <p className="mt-1 text-xs text-neutral-500">{r.note}</p>}
              </div>
            ),
            total: `Counted (${rows.filter(counted).length})`,
          },
          {
            label: "Raised by",
            className: "min-w-[10rem]",
            cell: (r) => (
              <div>
                <p className="text-neutral-800">{r.requester ?? "—"}</p>
                {r.department && <p className="text-xs text-neutral-500">{r.department}</p>}
              </div>
            ),
          },
          { label: "Raised on", className: "whitespace-nowrap", cell: (r) => day(r.raisedOn) },
          {
            label: "Charged to",
            className: "min-w-[9rem]",
            cell: (r) => (
              <div className="text-xs">
                <p className="text-sm text-neutral-700">{r.project ?? "—"}</p>
                {r.costCentre && <p className="text-neutral-500">{r.costCentre}</p>}
              </div>
            ),
          },
          {
            label: "Status",
            cell: (r) => (
              <span className="inline-flex flex-col items-start gap-1">
                <Chip hue={r.live ? "sky" : "slate"} dot>
                  {r.statusLabel}
                </Chip>
              </span>
            ),
          },
          { label: "Estimated", num: true, cell: (r) => amountCell(r, r.estimated), total: money(sum("estimated")) },
          { label: "Approved", num: true, cell: (r) => amountCell(r, r.approved), total: money(sum("approved")) },
          { label: "Actual", num: true, cell: (r) => amountCell(r, r.actual), total: money(sum("actual")) },
        ]}
      />
    </div>
  );
}
