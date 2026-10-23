"use client";

import {
  Building2,
  CalendarRange,
  PiggyBank,
  BookOpenCheck,
  CalendarCheck2,
  Clock3,
  Contact,
  FileBarChart2,
  FileSignature,
  FileSpreadsheet,
  FolderKanban,
  HandCoins,
  Landmark,
  Percent,
  LayoutDashboard,
  ListTree,
  NotebookPen,
  ReceiptText,
  Scale,
  ScrollText,
  Wallet,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  Users,
} from "lucide-react";
import WorkspaceShell, { type WsNavGroup, type WsTitle } from "@/components/workspace/WorkspaceShell";
import type { AuthUser } from "@/lib/auth-store";
import { mayUseFinance, type FinanceFeature } from "@/suite/finance/lib/finance-access";

/**
 * XwiftHQ Finance's navigation inside the workspace shell. Each entry shows
 * to admins and to whoever holds a key of its feature; the API is the check.
 */
const holds =
  (...features: FinanceFeature[]) =>
  (u: AuthUser | null) =>
    mayUseFinance(u, ...features);

/** Everybody in an organisation with Finance can ask for a payment or an advance. */
const anyone = (u: AuthUser | null) => Boolean(u?.organisationId);

const NAV: WsNavGroup[] = [
  {
    heading: "General",
    items: [
      { label: "Overview", href: "/suite/finance", icon: LayoutDashboard, exact: true, show: holds("reports", "banking", "journals") },
      { label: "My requests", href: "/suite/finance/requests", icon: HandCoins, show: anyone },
    ],
  },
  {
    heading: "Spend",
    items: [
      { label: "Memo register", href: "/suite/finance/memos", icon: ReceiptText, show: holds("memos") },
      { label: "FCU", href: "/suite/finance/fcu", icon: ShieldCheck, show: holds("fcu") },
      { label: "Payment vouchers", href: "/suite/finance/vouchers", icon: Stamp, show: holds("vouchers") },
      { label: "Payments", href: "/suite/finance/payments", icon: Send, show: holds("payments") },
      { label: "WHT", href: "/suite/finance/wht", icon: Percent, show: holds("wht") },
    ],
  },
  {
    heading: "Revenue",
    items: [
      { label: "Clients", href: "/suite/finance/revenue/clients", icon: Contact, show: holds("receipts") },
      { label: "Contracts", href: "/suite/finance/revenue/contracts", icon: FileSignature, show: holds("contracts") },
      { label: "Invoices", href: "/suite/finance/revenue/invoices", icon: ScrollText, show: holds("invoices") },
      { label: "Receipts", href: "/suite/finance/revenue/receipts", icon: Wallet, show: holds("receipts") },
      { label: "Receivables", href: "/suite/finance/revenue/receivables", icon: Scale, show: holds("receipts", "invoices") },
    ],
  },
  {
    heading: "Projects",
    items: [
      { label: "Project funds", href: "/suite/finance/projects", icon: FolderKanban, show: holds("project_funds") },
      { label: "Labour costing", href: "/suite/finance/labour", icon: Clock3, show: holds("labour") },
      { label: "Budgets", href: "/suite/finance/budgets", icon: PiggyBank, show: holds("budgets") },
      { label: "Cash forecast", href: "/suite/finance/cash-forecast", icon: CalendarRange, show: holds("cash_forecast") },
    ],
  },
  {
    heading: "Ledger",
    items: [
      { label: "Journals", href: "/suite/finance/journals", icon: NotebookPen, show: holds("journals") },
      { label: "Chart of accounts", href: "/suite/finance/accounts", icon: ListTree, show: holds("accounts") },
      { label: "Fixed assets", href: "/suite/finance/fixed-assets", icon: Building2, show: holds("fixed_assets") },
      { label: "Periods & close", href: "/suite/finance/periods", icon: CalendarCheck2, show: holds("periods") },
    ],
  },
  {
    heading: "Banking",
    items: [
      { label: "Bank accounts", href: "/suite/finance/banking", icon: Landmark, exact: true, show: holds("banking", "statements") },
      { label: "Statements", href: "/suite/finance/banking/imports", icon: FileSpreadsheet, show: holds("statements") },
      { label: "Statement rules", href: "/suite/finance/banking/rules", icon: SlidersHorizontal, show: holds("bank_rules") },
      { label: "Payroll postings", href: "/suite/finance/payroll", icon: Users, show: holds("payroll") },
    ],
  },
  {
    heading: "Reports",
    items: [
      { label: "Company report", href: "/suite/finance/reports/company", icon: FileBarChart2, show: holds("reports") },
      { label: "Financial statements", href: "/suite/finance/reports", icon: Scale, exact: true, show: holds("reports") },
      { label: "Trial balance", href: "/suite/finance/reports/trial-balance", icon: BookOpenCheck, show: holds("reports") },
    ],
  },
  {
    heading: "Settings",
    items: [{ label: "Spend settings", href: "/suite/finance/settings/spend", icon: Settings2, show: holds("spend_settings") }],
  },
];

/** Titles for pages the nav does not name. */
const TITLES: WsTitle[] = [
  { match: "/suite/finance/requests/new", title: "New request" },
  { match: "/suite/finance/requests/", title: "Request" },
  { match: "/suite/finance/memos/", title: "Memo" },
  { match: "/suite/finance/fcu/exceptions", title: "Exceptions" },
  { match: "/suite/finance/fcu/", title: "FCU review" },
  { match: "/suite/finance/vouchers/new", title: "New voucher" },
  { match: "/suite/finance/vouchers/", title: "Payment voucher" },
  { match: "/suite/finance/payments/", title: "Payment schedule" },
  { match: "/suite/finance/wht/", title: "WHT schedule" },
  { match: "/suite/finance/projects/", title: "Project funds" },
  { match: "/suite/finance/revenue/contracts/", title: "Contract" },
  { match: "/suite/finance/revenue/invoices/new", title: "New invoice" },
  { match: "/suite/finance/revenue/invoices/", title: "Invoice" },
  { match: "/suite/finance/revenue/receipts/new", title: "Record a receipt" },
  { match: "/suite/finance/revenue/receipts/", title: "Receipt" },
  { match: "/suite/finance/revenue/clients/", title: "Client statement" },
  { match: "/suite/finance/fixed-assets/", title: "Fixed asset" },
  { match: "/suite/finance/budgets/", title: "Budget" },
  { match: "/suite/finance/labour/runs/", title: "Labour run" },
  { match: "/suite/finance/labour/", title: "Labour month" },
  { match: "/suite/finance/journals/recurring/new", title: "New recurring journal" },
  { match: "/suite/finance/journals/recurring/", title: "Recurring journal" },
  { match: "/suite/finance/journals/recurring", title: "Recurring journals" },
  { match: "/suite/finance/journals/new", title: "New journal" },
  { match: "/suite/finance/journals/", title: "Journal" },
  { match: "/suite/finance/banking/imports/", title: "Bank statement" },
  { match: "/suite/finance/banking/", contains: "/reconciliation/", title: "Reconciliation" },
  { match: "/suite/finance/banking/", title: "Bank account" },
  { match: "/suite/finance/reports/company", title: "Company report" },
  { match: "/suite/finance/reports/income-statement", title: "Income statement" },
  { match: "/suite/finance/reports/balance-sheet", title: "Financial position" },
  { match: "/suite/finance/reports/cash-flow", title: "Cash flow" },
  { match: "/suite/finance/reports/ledger/", title: "Account ledger" },
];

export default function FinanceShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell module="finance" nav={NAV} titles={TITLES} requiresOrganisation="Finance">
      {children}
    </WorkspaceShell>
  );
}
