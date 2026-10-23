import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { ThreeWayMatch } from "@/suite/finance/components/marketing/ThreeWayMatch";
import { AssetLifecycle } from "@/suite/admin/components/marketing/AssetLifecycle";
import { AuthorityMatrix } from "@/suite/admin/components/marketing/AuthorityMatrix";
import { PolicyEvidenceChain } from "@/suite/admin/components/marketing/PolicyEvidenceChain";

/**
 * The four blocks where the Admin & Operations page earns its keep.
 *
 * Each block is copy on one side and a drawn screen on the other, sitting on
 * a lilac wash so the drawing reads as a product frame rather than a loose
 * card. The block number is a small lilac pill, and the points use the purple
 * check circle shared by every module page.
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
    title: "Procure to pay, with a three-way match",
    paragraphs: [
      "A purchase request says what you need, what it costs and which project or cost centre pays for it. Quotations come back against a request for quotation, the award is recorded, and the order goes out as a numbered LPO or LSO. When it changes, it is revised, never overwritten.",
      "Goods arrive on a GRN and services on a completion certificate, so every vendor invoice meets an order and a receipt before anyone is asked to pay. A match becomes a payment memo in Finance. A mismatch is held, with the reason attached.",
    ],
    points: [
      "Purchase requests, RFQs, quotations and awards, with the evaluation kept",
      "Local purchase and service orders with numbered revisions",
      "Goods-received notes and service completion certificates",
      "A three-way match on every vendor invoice before a payment memo is raised",
      "Commitments tracked against the project's funds from request to order to memo",
    ],
    visual: <ThreeWayMatch tone="neutral" />,
  },
  {
    number: "02",
    title: "Assets, stores, premises and fleet, each with a holder and a history",
    paragraphs: [
      "Every asset has a custodian and a trail: handover notes the receiver acknowledges, gate passes when it leaves the building, and verification campaigns that prove it is still there. When someone leaves, exit clearance lists what they hold and settles it against their final pay.",
      "Stores run on a stock ledger. Requisitions are issued on an SIV, counts are approved by a second person, and reorder levels are checked every hour. Maintenance plans raise work orders, with a warranty check before any paid repair. Leases raise rent memos. Service contracts are paid only after a monthly confirmation. Fleet papers sit on the compliance calendar.",
    ],
    points: [
      "Asset register, requests, handover notes, gate passes and verification",
      "Exit clearance tied to HRM final pay, and assets booked in Finance on voucher approval",
      "Stores on a stock ledger: requisitions to SIV, counts and hourly reorder checks",
      "Maintenance plans and work orders, with a warranty check before paid repairs",
      "Leases, service contracts, utilities and the diesel log",
      "Vehicles, papers, bookings and trips, plus a service desk with a catalogue and tickets",
    ],
    visual: <AssetLifecycle />,
  },
  {
    number: "03",
    title: "Travel and events, approved your way",
    paragraphs: [
      "Travel follows a policy by grade. Daily allowance, hotel and taxi rates are worked out for you, the advance is raised and bookings are made. Any change after approval carries its fee and needs its own approval. Every trip ends with a report, and the travel calendar shows who is away.",
      "Events, workshops and client engagements carry a budget, and its lines feed the purchases, trips and advances that deliver them. Every request follows the approval rules your organisation sets (head of department first, the MD above a set band) and commits against the project it is charged to.",
    ],
    points: [
      "Travel policy by grade, with DTA, hotel and taxi worked out for you",
      "Advances, bookings, approved changes with their fees, and trip reports",
      "A travel calendar of who is away, where and why",
      "Events, workshops and engagements with budget lines that drive spend",
      "Client payment requests raised from the engagement",
      "Approval routes, bands and roles set per organisation, all in one inbox",
    ],
    visual: <AuthorityMatrix />,
  },
  {
    number: "04",
    title: "Evidence, not paperwork",
    paragraphs: [
      "Every document lives in one repository. Controlled documents (policies, procedures, forms) are approved before they are issued and versioned when they change. The people they apply to acknowledge them, against the exact version they read.",
      "Licences, permits, insurances and registrations sit on a compliance calendar with daily alerts. Need a bid pack? The current certificates download as one ZIP. Outgoing letters are numbered in the correspondence register, and visitors are pre-registered with a badge ready.",
    ],
    points: [
      "A document repository with controlled documents, versions and disposal",
      "Policy acknowledgement, per person and per version",
      "A compliance calendar with daily alerts, and a bid pack in one ZIP",
      "A correspondence register with numbered outgoing letters",
      "Visitor pre-registration and badges",
    ],
    visual: <PolicyEvidenceChain />,
  },
];

export function AdminDeepDive() {
  return (
    <div className="space-y-16 lg:space-y-24">
      {BLOCKS.map((block, index) => (
        <article
          key={block.number}
          className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
        >
          <div className={`min-w-0 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
            <p className="xw-eyebrow tnum">
              <span className="sr-only">Block </span>
              {block.number}
            </p>

            <h3 className="mt-4 font-heading text-2xl font-bold leading-snug tracking-[-0.02em] text-neutral-900">
              {block.title}
            </h3>

            <div className="mt-4 max-w-prose space-y-3">
              {block.paragraphs.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-neutral-600">
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

          <div className="min-w-0 rounded-[1.5rem] bg-gradient-to-br from-primary-100 via-primary-50 to-white p-3 sm:p-6">
            {block.visual}
          </div>
        </article>
      ))}
    </div>
  );
}
