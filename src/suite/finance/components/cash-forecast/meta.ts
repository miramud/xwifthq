import { FileSignature, Landmark, ReceiptText, Repeat, Stamp, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { ForecastKind, Frequency } from "@/lib/api/finance-budgets-client";

/* The cash forecast's words and colours: what each kind of item is and where it comes from. */

export const KIND: Record<ForecastKind, { label: string; hue: Hue; icon: LucideIcon; from: string }> = {
  receipts: { label: "Client receipts", hue: "mint", icon: Wallet, from: "Open invoices by due date; overdue ones at the collection percentage" },
  pipeline: { label: "Contract pipeline", hue: "sky", icon: FileSignature, from: "Milestones not yet invoiced, at the pipeline percentage, paid about 30 days after" },
  vouchers: { label: "Payment vouchers", hue: "coral", icon: Stamp, from: "Vouchers approved, scheduled or in approval and not yet paid" },
  memos: { label: "Approved requests", hue: "grape", icon: ReceiptText, from: "Requests cleared but not yet on a voucher, by when they are needed" },
  payroll: { label: "Payroll", hue: "sun", icon: Users, from: "Net pay at each month end, as last month" },
  statutory: { label: "PAYE and pension", hue: "rose", icon: Landmark, from: "PAYE by the 10th, pension within 7 days of pay" },
  recurring: { label: "Recurring items", hue: "slate", icon: Repeat, from: "Rent, subscriptions and the like, kept by Finance" },
};

export const FREQUENCY: Record<Frequency, string> = {
  weekly: "Every week",
  monthly: "Every month",
  quarterly: "Every quarter",
  annual: "Every year",
  once: "Once",
};

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-05`, `2026-10-11` → `5–11 Oct`; across months `28 Sep – 4 Oct`. */
export function weekRange(from: string, to: string): string {
  const [, fm, fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  if (!fm || !tm) return `${from} to ${to}`;
  return fm === tm ? `${fd} to ${td} ${SHORT[tm - 1]}` : `${fd} ${SHORT[fm - 1]} to ${td} ${SHORT[tm - 1]}`;
}

/** `2026-10-05` → `5 Oct`. */
export function dayShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${SHORT[m - 1]}` : iso;
}
