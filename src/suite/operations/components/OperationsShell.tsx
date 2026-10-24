"use client";

import WorkspaceShell, { type WsTitle } from "@/components/workspace/WorkspaceShell";
import { OPERATIONS_NAV } from "./nav";

/** Titles for pages the nav does not name. */
const TITLES: WsTitle[] = [
  { match: "/suite/operations/my/requests/new", title: "New purchase request" },
  { match: "/suite/operations/my/requests/", title: "Purchase request" },
  { match: "/suite/operations/my/trips/new", title: "New trip" },
  { match: "/suite/operations/my/trips/", title: "Trip" },
  { match: "/suite/operations/my/events/new", title: "New event" },
  { match: "/suite/operations/my/events/", title: "Event" },
  { match: "/suite/operations/procurement/requests/", title: "Sourcing" },
  { match: "/suite/operations/procurement/orders/", title: "Purchase order" },
  { match: "/suite/operations/travel/", title: "Trip" },
  { match: "/suite/operations/events/", title: "Event" },
  { match: "/suite/operations/clients/requests/new", title: "New client payment request" },
  { match: "/suite/operations/clients/requests/", title: "Client payment request" },
  { match: "/suite/operations/assets/requests/", title: "Asset request" },
  { match: "/suite/operations/assets/verification/", title: "Verification" },
  { match: "/suite/operations/assets/exit-clearances/", title: "Exit clearance" },
  { match: "/suite/operations/assets/categories", title: "Asset categories and kits" },
  { match: "/suite/operations/assets/", title: "Asset" },
  { match: "/suite/operations/stores/requisitions/", title: "Requisition" },
  { match: "/suite/operations/stores/counts/", title: "Stock count" },
  { match: "/suite/operations/stores/consumption", title: "Consumption" },
  { match: "/suite/operations/compliance/bid-pack", title: "Bid-readiness pack" },
  { match: "/suite/operations/desk/catalogue", title: "Request catalogue" },
  { match: "/suite/operations/desk/", title: "Ticket" },
  { match: "/suite/operations/maintenance/plans", title: "Maintenance plans" },
  { match: "/suite/operations/maintenance/claims", title: "Insurance claims" },
  { match: "/suite/operations/maintenance/reports", title: "Maintenance reports" },
  { match: "/suite/operations/maintenance/", title: "Work order" },
  { match: "/suite/operations/facilities/contracts", title: "Service contracts" },
  { match: "/suite/operations/facilities/leases", title: "Leases" },
  { match: "/suite/operations/facilities/visitors", title: "Visitors" },
  { match: "/suite/operations/facilities/rooms", title: "Room bookings" },
  { match: "/suite/operations/facilities/reports", title: "Utilities and diesel" },
  { match: "/suite/operations/facilities/", title: "Facility" },
  { match: "/suite/operations/fleet/", title: "Vehicle" },
  { match: "/suite/operations/my/help/", title: "My request" },
  { match: "/suite/operations/my/correspondence/", title: "Letter for my action" },
  { match: "/suite/operations/correspondence/", title: "Letter" },
  { match: "/suite/operations/compliance/", title: "Compliance item" },
  { match: "/suite/operations/documents/controlled/", title: "Controlled document" },
  { match: "/suite/operations/documents/", title: "Document" },
];

export default function OperationsShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell module="admin" nav={OPERATIONS_NAV} titles={TITLES} requiresOrganisation="Admin & Operations">
      {children}
    </WorkspaceShell>
  );
}

