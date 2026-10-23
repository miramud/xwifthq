import {
  Building2,
  Package,
  Plane,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

/**
 * Who opens Admin & Operations, and what they open it for.
 *
 * The tile is `neutral-900/8` with a `neutral-700` glyph — the registry's own
 * ink pairing rather than a borrowed hue. Four cards of ink read as deliberate
 * where four cards of a substitute colour would read as a page that lost its
 * nerve.
 */

interface Role {
  icon: LucideIcon;
  title: string;
  opensItFor: string;
  tasks: string[];
}

const ROLES: readonly Role[] = [
  {
    icon: Building2,
    title: "Operations Manager",
    opensItFor: "The overview: what is being bought, who is travelling, what is due.",
    tasks: [
      "Approves requests inside the band the organisation's rules give them",
      "Watches the compliance calendar, leases and service contracts",
      "Confirms service contracts each month before they are paid",
    ],
  },
  {
    icon: ShoppingBag,
    title: "Procurement Officer",
    opensItFor: "The line from a purchase request to a matched invoice.",
    tasks: [
      "Sends RFQs, compares quotations and records the award",
      "Issues LPOs and LSOs, and revises them with a trail",
      "Matches the vendor invoice to the order and the GRN before a memo is raised",
    ],
  },
  {
    icon: Plane,
    title: "Travel Desk",
    opensItFor: "This week's trips and the requests waiting to be booked.",
    tasks: [
      "Applies the travel policy by grade — allowance, hotel and taxi",
      "Makes bookings and records approved changes with their fees",
      "Keeps the travel calendar and collects trip reports",
    ],
  },
  {
    icon: Package,
    title: "Store & Asset Officer",
    opensItFor: "Stock levels, issues waiting, and who is holding what.",
    tasks: [
      "Issues stock against requisitions and runs counts for a second approver",
      "Tags assets, writes handover notes and runs verification campaigns",
      "Signs off exit clearance so final pay can be settled",
    ],
  },
];

export function AdminRoles() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {ROLES.map((role) => {
        const Glyph = role.icon;
        return (
          <div
            key={role.title}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-900/8">
                <Glyph
                  className="h-6 w-6 text-neutral-700"
                  aria-hidden="true"
                />
              </span>
              <h3 className="font-heading text-lg font-semibold text-neutral-900">
                {role.title}
              </h3>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              {role.opensItFor}
            </p>

            <ul className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
              {role.tasks.map((task) => (
                <li
                  key={task}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-700"
                >
                  <span
                    className="mt-2 h-1 w-3 shrink-0 rounded-full bg-neutral-400"
                    aria-hidden="true"
                  />
                  {task}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
