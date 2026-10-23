import {
  ArchiveRestore,
  FolderTree,
  IdCard,
  Inbox,
  Network,
  QrCode,
  ScrollText,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/**
 * Everything the five modules share, in one list.
 *
 * The home page's spine section and `/platform` both print it, so it lives
 * here once. It is fuller than `SPINE_FACILITIES` in the product registry on
 * purpose: that list carries six short labels the pricing page keys its notes
 * on, and is left alone; this one is the set the suite is sold on (owner,
 * 9 October 2026) — approvals, the inbox and delegation, the recycle bin,
 * verifiable documents and cross-module events included.
 */

export const SHARED_SPINE: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: IdCard,
    title: "One sign-in",
    body: "A person is created once and signs in once to every module they are given. High-value approvals ask for a second check before they go through.",
  },
  {
    icon: FolderTree,
    title: "One organisation structure",
    body: "Units, cost centres and job titles are set once in the organisation console. HR staffs them, Finance budgets against them and Projects draws its teams from them.",
  },
  {
    icon: ShieldCheck,
    title: "One set of roles",
    body: "Starter roles for every module, plus roles you define from a permission list generated from the product itself. Leavers lose their access automatically.",
  },
  {
    icon: Workflow,
    title: "One approval engine",
    body: "Each process — a purchase, a trip, a payment, a job requisition — gets the levels and amount bands your organisation chooses, in one place, not five.",
  },
  {
    icon: Inbox,
    title: "One inbox, with delegation",
    body: "Everything waiting on a person, from every module, in one approvals inbox. Delegation of authority covers anyone who is away, and the record says who acted for whom.",
  },
  {
    icon: ScrollText,
    title: "One audit trail",
    body: "Every change in every module writes who, what and when to the same trail. Evidence for a payment and evidence for a contract come out of one place.",
  },
  {
    icon: ArchiveRestore,
    title: "One recycle bin",
    body: "Every delete asks first and lands in your organisation's recycle bin, where it can be restored. Stored secrets are the exception: removed means really gone.",
  },
  {
    icon: QrCode,
    title: "Documents that verify themselves",
    body: "Vouchers, memos, orders and reports print as PDFs on your letterhead with a QR code. Anyone holding the paper can check it is genuine.",
  },
  {
    icon: Network,
    title: "Modules that tell each other",
    body: "An approved payroll posts its journal; an unreturned laptop becomes a final-pay deduction; an approved voucher books the asset. Each event is delivered once, and only to modules you have switched on.",
  },
];

export function SharedSpineGrid({ className = "" }: { className?: string }) {
  return (
    <ul
      className={`grid gap-x-10 border-t border-dashed border-neutral-300 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {SHARED_SPINE.map((item) => {
        const Glyph = item.icon;

        return (
          <li key={item.title} className="border-b border-dashed border-neutral-300 py-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10">
              <Glyph className="h-5 w-5 text-primary-600" aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-heading text-lg font-semibold text-neutral-900">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
