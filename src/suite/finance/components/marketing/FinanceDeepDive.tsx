import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { TrialBalanceMock } from "@/suite/finance/components/marketing/TrialBalanceMock";
import { SpendPipeline } from "@/suite/finance/components/marketing/SpendPipeline";
import { BudgetVariance } from "@/suite/finance/components/marketing/BudgetVariance";
import { LedgerInflows } from "@/suite/finance/components/marketing/LedgerInflows";

/**
 * The four blocks where the Finance page earns its keep.
 *
 * Each block opens with a lilac pill eyebrow carrying its number, then the
 * title, the prose and a list of purple check circles. The drawing sits on a
 * pale bento tile, so the white mock reads as a product card lifted off the
 * page. The module's gold is kept for small accents inside the drawings.
 */

interface Block {
  number: string;
  title: string;
  paragraphs: string[];
  points: string[];
  visual: ReactNode;
}

const BLOCKS: readonly Block[] = [
  {
    number: "01",
    title: "A ledger, and a month-end close that is just a review",
    paragraphs: [
      "Start from a chart-of-accounts template and adjust it, so you never face a blank page. Journals carry their source document, recurring journals post themselves, and accruals reverse on the first day of the next period without anyone having to remember.",
      "Periods close in two steps: soft-closed while the last adjustments land, then locked. Payroll arrives from HRM as a journal by cost centre, and every statement drills down to the entry behind each figure.",
    ],
    points: [
      "Chart-of-accounts templates, cost centres and dimensions, set in the organisation console",
      "Manual, recurring and auto-reversing journals, each with its source document",
      "Soft close and lock for every period. Locked means locked",
      "Trial balance, income statement, financial position, cash flow and cash position",
      "Import bank statements from PDF or CSV, classify them by rules, and reconcile with a printable report",
      "Payroll journal posted from HRM by cost centre, and paid through Finance",
    ],
    visual: <TrialBalanceMock />,
  },
  {
    number: "02",
    title: "Spend to pay, with a control at every step",
    paragraphs: [
      "Every payment that leaves your company starts as a payment or advance memo, charged to a project or cost centre. The finance control unit clears it against a checklist. A payment voucher is raised with a gap-free number and the withholding tax worked out. Treasury then pays it from an approved schedule and bank file.",
      "A payment is final only once it is confirmed against the imported bank statement. Advances are retired with receipts, ageing commitments expire, and urgent spend made before approval is regularised after the fact, not hidden.",
    ],
    points: [
      "Payment and advance memos, finance control unit checkpoints and payment vouchers",
      "Payment schedules with a second approver, plus a bank file ready to upload",
      "Confirmation against the statement line, then advances retired",
      "Separation of duties enforced, and post-facto regularisation with a recorded reason",
      "Withholding tax remittances and supplier certificates, straight from the same vouchers",
      "Step-up authentication via an authenticator app for high-value approvals",
    ],
    visual: <SpendPipeline />,
  },
  {
    number: "03",
    title: "Budgets you can enforce, funds the MD releases",
    paragraphs: [
      "Each project gets a budget by category and month. The managing director releases funds in tranches, and approved spend is committed against what was released. A memo that would overspend stops at an insufficient-funds check. Only the MD can pass it, with a reason on record.",
      "Company budgets sit over cost centres with a BLOCK or WARN control, so a voucher that breaks a budget is refused or flagged before it is paid. The cash forecast shows what you will need from the bank in the weeks ahead.",
    ],
    points: [
      "Project budgets by category and month, released in tranches by the MD",
      "Commitments, insufficient-funds checks, and a recorded MD override",
      "An MD portfolio with RAG status and earned value: CPI, SPI, EAC and the S-curve",
      "Company budgets against actual, with each line set to BLOCK or WARN",
      "A cash forecast built from scheduled payments, receipts and planned items",
    ],
    visual: <BudgetVariance />,
  },
  {
    number: "04",
    title: "Revenue in, plus the journals other modules write",
    paragraphs: [
      "Client contracts carry their milestones, and invoices follow them. Receipts are recorded with withholding tax and retention split out, in the client's currency where it differs. Client advances apply to later invoices, and aged receivables and client statements are always up to date.",
      "Labour is costed from payroll and from time logged in Projects, so utilisation and project profit come from real hours. Assets bought through Operations land in the fixed-asset register when their voucher is approved, then depreciate monthly.",
    ],
    points: [
      "Contracts and milestones, invoices, receipts with WHT and retention, and client advances",
      "Multi-currency receipts, aged receivables and client statements",
      "Labour costing from payroll, with utilisation by person and by project",
      "Fixed assets and depreciation, booked when the voucher is approved",
      "Branded PDFs with a QR code anyone can scan to verify them",
    ],
    visual: <LedgerInflows />,
  },
];

export function FinanceDeepDive() {
  return (
    <div className="space-y-16 lg:space-y-24">
      {BLOCKS.map((block, index) => (
        <article
          key={block.number}
          className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
        >
          <div
            className={`min-w-0 ${index % 2 === 1 ? "lg:order-2" : ""}`}
          >
            <p className="xw-eyebrow tnum">
              <span className="sr-only">Part </span>
              {block.number}
            </p>

            <h3 className="mt-4 font-heading text-2xl font-bold leading-snug tracking-[-0.02em] text-neutral-900 sm:text-[1.75rem]">
              {block.title}
            </h3>

            <div className="mt-4 max-w-prose space-y-3">
              {block.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="leading-relaxed text-neutral-600"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <ul className="mt-6 space-y-3">
              {block.points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3 text-primary-700" />
                  </span>
                  <span className="text-sm leading-relaxed text-neutral-700">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="xw-tile min-w-0 p-3 sm:p-6">{block.visual}</div>
        </article>
      ))}
    </div>
  );
}
