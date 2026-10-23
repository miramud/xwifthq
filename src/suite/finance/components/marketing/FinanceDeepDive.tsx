import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { TrialBalanceMock } from "@/suite/finance/components/marketing/TrialBalanceMock";
import { SpendPipeline } from "@/suite/finance/components/marketing/SpendPipeline";
import { BudgetVariance } from "@/suite/finance/components/marketing/BudgetVariance";
import { LedgerInflows } from "@/suite/finance/components/marketing/LedgerInflows";

/**
 * The four blocks where the Finance page earns its keep.
 *
 * Gold appears in exactly two roles down this section: the block number's rule,
 * and the check glyph at `accent-600` — the value calibrated for a glyph on
 * white (3.4:1). Gold *text* would need `accent-700`; `accent-500` would be
 * unreadable at either. Teal stays on the CTAs, which live elsewhere on the
 * page, because the hue is a label and not a theme.
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
    title: "The ledger, and a close that is a review",
    paragraphs: [
      "Start from a chart-of-accounts template and adjust it, rather than designing one from a blank page. Journals carry their source document; recurring journals post themselves, and accruals reverse on the first day of the next period without anyone remembering to do it.",
      "Periods close in two steps — soft-closed while the last adjustments land, then locked. Payroll arrives from HRM as a journal by cost centre, and every statement drills down to the entry behind the figure.",
    ],
    points: [
      "Chart-of-accounts templates, cost centres and dimensions from the organisation console",
      "Manual, recurring and auto-reversing journals, each with its source document",
      "Periods with soft close and lock; a locked period stays locked",
      "Trial balance, income statement, financial position, cash flow and cash position",
      "Bank statements imported from PDF or CSV, classified by rules, reconciled with a printable report",
      "Payroll journal posted from HRM, by cost centre, and paid through Finance",
    ],
    visual: <TrialBalanceMock />,
  },
  {
    number: "02",
    title: "Spend to pay, with a control at every step",
    paragraphs: [
      "Every payment that leaves the company starts as a payment or advance memo charged to a project or cost centre. The finance control unit clears it against a checklist, a payment voucher is raised with a gap-free number and the withholding tax worked out, and treasury pays it from an approved schedule and bank file.",
      "The payment is final only when it is confirmed against the imported bank statement. Advances are retired with receipts, ageing commitments expire, and urgent spend made before approval is regularised after the fact rather than hidden.",
    ],
    points: [
      "Payment and advance memos, finance control unit checkpoints and payment vouchers",
      "Payment schedules with a second approver, and the bank file generated for upload",
      "Confirmation against the statement line, then retirement of advances",
      "Separation of duties enforced; post-facto regularisation with a recorded reason",
      "Withholding tax remittances and supplier certificates from the same vouchers",
      "Step-up authentication from an authenticator app on high-value approvals",
    ],
    visual: <SpendPipeline />,
  },
  {
    number: "03",
    title: "Budgets the company can enforce, funds the MD releases",
    paragraphs: [
      "Each project gets a budget by category and month. The managing director releases funds in tranches, approved spend is committed against what was released, and a memo that would overspend stops at an insufficient-funds check — passable only by the MD, with a reason on record.",
      "Company budgets sit over cost centres with a BLOCK or WARN control, so a voucher that breaks a budget is refused or flagged before it is paid. The cash forecast shows what the next weeks will need from the bank.",
    ],
    points: [
      "Project budgets by category and month, released in tranches by the MD",
      "Commitments, insufficient-funds checks and a recorded MD override",
      "MD portfolio with RAG status and earned value: CPI, SPI, EAC and the S-curve",
      "Company budgets against actual, each line set to BLOCK or WARN",
      "Cash forecast from scheduled payments, receipts and planned items",
    ],
    visual: <BudgetVariance />,
  },
  {
    number: "04",
    title: "Revenue in, and the journals other modules write",
    paragraphs: [
      "Client contracts carry their milestones; invoices follow them, and receipts are recorded with withholding tax and retention split out, in the client's currency where it differs. Client advances apply to later invoices, and aged receivables and client statements are always current.",
      "Labour is costed from payroll and from time logged in Projects, so utilisation and project profit come from real hours. Assets bought through Operations are booked to the fixed-asset register when their voucher is approved, and depreciate monthly from there.",
    ],
    points: [
      "Contracts and milestones, invoices, receipts with WHT and retention, client advances",
      "Multi-currency receipts, aged receivables and client statements",
      "Labour costing from payroll, with utilisation by person and project",
      "Fixed assets and depreciation, booked on voucher approval",
      "Branded PDFs with a QR code anyone can scan to verify the document",
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
            <p className="label-mono tnum flex items-center gap-2.5 text-neutral-500">
              <span
                className="h-0.5 w-7 rounded-full bg-accent-500"
                aria-hidden="true"
              />
              {block.number}
            </p>

            <h3 className="heading-4 mt-3 text-neutral-900">{block.title}</h3>

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

            <ul className="mt-6 space-y-2.5 border-t border-neutral-200 pt-6">
              {block.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-accent-600"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed text-neutral-700">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">{block.visual}</div>
        </article>
      ))}
    </div>
  );
}
