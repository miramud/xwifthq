import { CircleCheckBig, CircleDashed, Clock3, Hourglass, Send, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { CsvCell } from "@/components/workspace/csv";
import { csvAmount, csvDate } from "@/components/workspace/csv";
import { whtRate, type WhtMonth, type WhtMonthDetail } from "@/lib/api/finance-wht-client";

/* WHT remittances in the words of the person reading them. Nothing here fetches. */

type Meta = { label: string; hue: Hue; icon: LucideIcon };

const STATUS: Record<string, Meta> = {
  nothing: { label: "No WHT", hue: "slate", icon: CircleDashed },
  open: { label: "Month running", hue: "sky", icon: Hourglass },
  due: { label: "To remit", hue: "sun", icon: Clock3 },
  draft: { label: "Being raised", hue: "sky", icon: Hourglass },
  memo_raised: { label: "Memo raised", hue: "grape", icon: Send },
  paid: { label: "Remitted", hue: "mint", icon: CircleCheckBig },
  cancelled: { label: "Memo cancelled", hue: "rose", icon: TriangleAlert },
};

/** An overdue month reads as overdue, whatever else is true. */
export function whtStatus(status: string, overdue = false): Meta {
  if (overdue && status === "due") return { label: "Overdue", hue: "coral", icon: TriangleAlert };
  return STATUS[status] ?? { label: status.replace(/_/g, " "), hue: "slate", icon: CircleDashed };
}

/** The month's schedule as the CSV the tax adviser or the auditor opens. */
export function scheduleCsv(d: WhtMonthDetail): CsvCell[][] {
  const rows: CsvCell[][] = [["Period", "Supplier", "Supplier TIN", "Recognised on", "Voucher", "Memo", "Description", "WHT class", "Rate", "Currency", "Gross", "WHT"]];
  for (const s of d.suppliers) {
    for (const l of s.lines) {
      rows.push([d.period, s.name, s.tin ?? "", csvDate(l.date), l.pvNo, l.memoReference ?? "", l.description, l.whtCode, whtRate(l.rateBp), d.currency, csvAmount(l.gross), csvAmount(l.wht)]);
    }
  }
  rows.push([d.period, "Total", "", "", "", "", "", "", "", d.currency, csvAmount(d.totals.gross), csvAmount(d.totals.wht)]);
  return rows;
}

/** Months still owed to the tax authority (ended, not raised), oldest first. */
export const owing = (months: WhtMonth[]) => months.filter((m) => m.status === "due" && m.wht > 0).sort((a, b) => a.period.localeCompare(b.period));
