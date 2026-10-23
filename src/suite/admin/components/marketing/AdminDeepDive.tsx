import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { ThreeWayMatch } from "@/suite/finance/components/marketing/ThreeWayMatch";
import { AssetLifecycle } from "@/suite/admin/components/marketing/AssetLifecycle";
import { AuthorityMatrix } from "@/suite/admin/components/marketing/AuthorityMatrix";
import { PolicyEvidenceChain } from "@/suite/admin/components/marketing/PolicyEvidenceChain";

/**
 * The four blocks where the Admin & Operations page earns its keep.
 *
 * No hue reaches this section. The block number sits above a neutral-700 rule,
 * the check glyph is neutral-700, and the hierarchy is carried by type size,
 * hairlines and space. That is the argument the whole page is making — Admin is
 * the chassis, its restraint is the point — and substituting some other brand
 * colour to make the section feel warmer would quietly contradict it.
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
    title: "Procure to pay, matched three ways",
    paragraphs: [
      "A purchase request names what is needed, what it costs and which project or cost centre carries it. Quotations come back against a request for quotation, the award is recorded, and the order goes out as a numbered LPO or LSO — revised, never overwritten, when it changes.",
      "Goods are received on a GRN and services on a completion certificate, so the vendor's invoice meets an order and a receipt before anyone is asked to pay it. What matches becomes a payment memo in Finance; what does not is held with the reason on it.",
    ],
    points: [
      "Purchase requests, RFQs, quotations and awards with the evaluation kept",
      "Local purchase and service orders, with numbered revisions",
      "Goods-received notes and service completion certificates",
      "Vendor invoice three-way match before a payment memo is raised",
      "Commitments carried from request to order to memo against the project's funds",
    ],
    visual: <ThreeWayMatch tone="neutral" />,
  },
  {
    number: "02",
    title: "Assets, stores, premises and fleet — each with a holder and a history",
    paragraphs: [
      "Every asset has a custodian and a trail: handover notes the receiver acknowledges, gate passes when it leaves the building, verification campaigns to prove it is still there. When someone leaves, exit clearance lists what they hold and settles it against their final pay.",
      "Stores run on a stock ledger — requisitions issued on an SIV, counts approved by a second person, reorder levels checked every hour. Maintenance plans raise work orders with a warranty check before any paid repair; leases raise rent memos, service contracts are paid only after a monthly confirmation, and fleet papers sit on the compliance calendar.",
    ],
    points: [
      "Asset register, requests, handover notes, gate passes and verification",
      "Exit clearance linked to HRM final pay; assets booked in Finance on voucher approval",
      "Stores with a stock ledger, requisitions to SIV, counts and hourly reorder",
      "Maintenance plans and work orders, with a warranty gate on paid repairs",
      "Leases, service contracts, utilities and the diesel log",
      "Vehicles, papers, bookings and trips; a service desk with a catalogue and tickets",
    ],
    visual: <AssetLifecycle />,
  },
  {
    number: "03",
    title: "Travel and events, approved by your own rules",
    paragraphs: [
      "Travel follows a policy by grade: daily allowance, hotel and taxi rates are worked out, the advance is raised, bookings are made, and any change after approval carries its fee and its own approval. The trip ends with a report, and the travel calendar shows who is away.",
      "Events, workshops and client engagements carry a budget whose lines feed the purchases, trips and advances that deliver them. Every request routes by the approval rules your organisation sets — head of department first, the MD above a band — and commits against the project it is charged to.",
    ],
    points: [
      "Travel policy by grade, with DTA, hotel and taxi worked out",
      "Advances, bookings, approved changes and fees, and trip reports",
      "A travel calendar of who is away, where and why",
      "Events, workshops and engagements with budget lines that feed spend",
      "Client payment requests raised from the engagement",
      "Approval routes, bands and roles set per organisation, in one inbox",
    ],
    visual: <AuthorityMatrix />,
  },
  {
    number: "04",
    title: "Evidence, not paperwork",
    paragraphs: [
      "Documents live in one repository. Controlled documents — policies, procedures, forms — are approved before they are issued, versioned when they change, and acknowledged by the people they apply to, against the version they read.",
      "Licences, permits, insurances and registrations sit on a compliance calendar with daily alerts, and a bid pack of the current certificates downloads as one ZIP. Outgoing letters are numbered in the correspondence register, and visitors are pre-registered with a badge waiting.",
    ],
    points: [
      "Document repository with controlled documents, versions and disposal",
      "Policy acknowledgement per person, per version",
      "Compliance calendar with daily alerts, and a bid pack as one ZIP",
      "Correspondence register with numbered outgoing letters",
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
            <p className="label-mono tnum flex items-center gap-2.5 text-neutral-500">
              <span
                className="h-0.5 w-7 rounded-full bg-neutral-700"
                aria-hidden="true"
              />
              {block.number}
            </p>

            <h3 className="heading-4 mt-3 text-neutral-900">{block.title}</h3>

            <div className="mt-4 max-w-prose space-y-3">
              {block.paragraphs.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-neutral-600">
                  {paragraph}
                </p>
              ))}
            </div>

            <ul className="mt-6 space-y-2.5 border-t border-neutral-200 pt-6">
              {block.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700"
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
