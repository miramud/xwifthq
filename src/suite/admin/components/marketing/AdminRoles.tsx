import {
  Building2,
  Check,
  Package,
  Plane,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

/**
 * Who opens Admin & Operations, and what they open it for.
 *
 * Four white cards in a two by two grid. The first carries the lilac corner
 * wash so the grid has a lead; each glyph sits in a round white tile, and the
 * tasks read as a checklist with the purple check circle.
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
    opensItFor: "The big picture: what is being bought, who is travelling and what falls due next.",
    tasks: [
      "Approves requests inside the bands your rules allow",
      "Watches the compliance calendar, leases and service contracts",
      "Confirms each service contract monthly before it is paid",
    ],
  },
  {
    icon: ShoppingBag,
    title: "Procurement Officer",
    opensItFor: "Every step from purchase request to matched invoice.",
    tasks: [
      "Sends RFQs, compares quotations and records the award",
      "Issues LPOs and LSOs, and revises them with a full trail",
      "Matches each vendor invoice to its order and GRN before a memo is raised",
    ],
  },
  {
    icon: Plane,
    title: "Travel Desk",
    opensItFor: "This week's trips, and the requests still waiting to be booked.",
    tasks: [
      "Applies the travel policy by grade: allowance, hotel and taxi",
      "Makes bookings and logs approved changes with their fees",
      "Keeps the travel calendar and collects trip reports",
    ],
  },
  {
    icon: Package,
    title: "Store & Asset Officer",
    opensItFor: "Stock levels, pending issues and who is holding what.",
    tasks: [
      "Issues stock against requisitions and runs counts for a second approver",
      "Tags assets, writes handover notes and runs verification campaigns",
      "Signs off exit clearance so final pay can be settled",
    ],
  },
];

export function AdminRoles() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {ROLES.map((role, i) => {
        const Glyph = role.icon;
        return (
          <div
            key={role.title}
            className={`min-w-0 p-6 sm:p-7 ${
              i === 0 ? "xw-glow-card" : "rounded-[1.25rem] border border-neutral-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-4">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-100"
                aria-hidden="true"
              >
                <Glyph className="h-5 w-5 text-primary-700" />
              </span>
              <h3 className="xw-h3">{role.title}</h3>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              {role.opensItFor}
            </p>

            <ul className="mt-5 space-y-3 border-t border-neutral-200/80 pt-5">
              {role.tasks.map((task) => (
                <li
                  key={task}
                  className="flex items-start gap-3 text-sm leading-relaxed text-neutral-700"
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3 text-primary-700" />
                  </span>
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
