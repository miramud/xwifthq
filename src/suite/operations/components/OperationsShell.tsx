"use client";

import {
  BookCheck,
  Building,
  CalendarClock,
  Car,
  Headset,
  LifeBuoy,
  Wrench,
  Boxes,
  FileText,
  FolderArchive,
  ShieldCheck,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Laptop,
  PackageOpen,
  ScanLine,
  Warehouse,
  FileStack,
  HandCoins,
  LayoutDashboard,
  Luggage,
  PackageCheck,
  Plane,
  ScrollText,
  ShoppingCart,
  SlidersHorizontal,
  Tent,
  Mailbox,
  MailOpen,
  UserPlus,
} from "lucide-react";
import WorkspaceShell, { type WsNavGroup, type WsTitle } from "@/components/workspace/WorkspaceShell";
import type { AuthUser } from "@/lib/auth-store";
import { isAdminRole } from "@/lib/roles";
import { mayUseOperations, type OperationsFeature } from "@/suite/operations/lib/operations-access";

/**
 * Admin & Operations navigation inside the workspace shell. Staff see their
 * own requests, trips and events; each desk shows to admins and to whoever
 * holds a key of its feature. The API is the check.
 */
const holds =
  (...features: OperationsFeature[]) =>
  (u: AuthUser | null) =>
    mayUseOperations(u, ...features);

const anyone = (u: AuthUser | null) => Boolean(u?.organisationId);

/** The document desk is Core's (`core.repository.*`): admins and holders of a key of it. */
const repository = (u: AuthUser | null) =>
  Boolean(u) && (isAdminRole(u) || (u?.permissions ?? []).some((p) => p.startsWith("core.repository.")));

const NAV: WsNavGroup[] = [
  {
    heading: "General",
    items: [
      { label: "Overview", href: "/suite/operations", icon: LayoutDashboard, exact: true, show: holds("overview") },
      { label: "My purchase requests", href: "/suite/operations/my/requests", icon: ShoppingCart, show: anyone },
      { label: "My trips", href: "/suite/operations/my/trips", icon: Luggage, show: anyone },
      { label: "My events", href: "/suite/operations/my/events", icon: Tent, show: anyone },
      { label: "My assets", href: "/suite/operations/my/assets", icon: Laptop, show: anyone },
      { label: "My requisitions", href: "/suite/operations/my/requisitions", icon: PackageOpen, show: anyone },
      { label: "Ask for help", href: "/suite/operations/my/help", icon: LifeBuoy, show: anyone },
      { label: "Book a room or vehicle", href: "/suite/operations/my/bookings", icon: CalendarClock, show: anyone },
      { label: "My visitors", href: "/suite/operations/my/visitors", icon: UserPlus, show: anyone },
      { label: "Letters for my action", href: "/suite/operations/my/correspondence", icon: MailOpen, show: anyone },
      { label: "Policies to read", href: "/suite/operations/my/policies", icon: BookCheck, show: anyone },
      { label: "Documents", href: "/suite/operations/my/documents", icon: FileText, show: anyone },
    ],
  },
  {
    heading: "Procurement",
    items: [
      { label: "Requests & sourcing", href: "/suite/operations/procurement/requests", icon: FileStack, show: holds("purchase_requests") },
      { label: "Purchase orders", href: "/suite/operations/procurement/orders", icon: ScrollText, show: holds("purchase_orders") },
      { label: "Receiving & invoices", href: "/suite/operations/procurement/receiving", icon: PackageCheck, show: holds("receiving") },
    ],
  },
  {
    heading: "Travel & events",
    items: [
      { label: "Travel desk", href: "/suite/operations/travel", icon: Plane, exact: true, show: holds("travel_desk") },
      { label: "Travel policy", href: "/suite/operations/travel/policy", icon: SlidersHorizontal, show: holds("travel_desk") },
      { label: "Events", href: "/suite/operations/events", icon: CalendarRange, show: holds("events") },
    ],
  },
  {
    heading: "Assets",
    items: [
      { label: "Asset register", href: "/suite/operations/assets", icon: Boxes, exact: true, show: holds("assets") },
      { label: "Asset requests", href: "/suite/operations/assets/requests", icon: ClipboardList, show: holds("asset_requests") },
      { label: "Verification", href: "/suite/operations/assets/verification", icon: ScanLine, show: holds("asset_verification") },
      { label: "Exit clearances", href: "/suite/operations/assets/exit-clearances", icon: DoorOpen, show: holds("exit_clearances") },
    ],
  },
  {
    heading: "Stores",
    items: [
      { label: "Stock", href: "/suite/operations/stores", icon: Warehouse, exact: true, show: holds("stores") },
      { label: "Requisitions", href: "/suite/operations/stores/requisitions", icon: ClipboardCheck, show: holds("stores") },
      { label: "Stock counts", href: "/suite/operations/stores/counts", icon: ClipboardList, show: holds("stores") },
    ],
  },
  {
    heading: "Facilities & fleet",
    items: [
      { label: "Service desk", href: "/suite/operations/desk", icon: Headset, exact: true, show: holds("service_desk") },
      { label: "Maintenance", href: "/suite/operations/maintenance", icon: Wrench, exact: true, show: holds("maintenance") },
      { label: "Facilities", href: "/suite/operations/facilities", icon: Building, exact: true, show: holds("facilities") },
      { label: "Fleet", href: "/suite/operations/fleet", icon: Car, exact: true, show: holds("fleet") },
    ],
  },
  {
    heading: "Governance",
    items: [
      { label: "Compliance", href: "/suite/operations/compliance", icon: ShieldCheck, show: holds("compliance") },
      { label: "Correspondence", href: "/suite/operations/correspondence", icon: Mailbox, show: holds("correspondence") },
      { label: "Document repository", href: "/suite/operations/documents", icon: FolderArchive, exact: true, show: repository },
      { label: "Policies and SOPs", href: "/suite/operations/documents/controlled", icon: BookCheck, show: repository },
    ],
  },
  {
    heading: "Clients",
    items: [{ label: "Client payments", href: "/suite/operations/clients/requests", icon: HandCoins, show: holds("client_payments") }],
  },
];

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
    <WorkspaceShell module="admin" nav={NAV} titles={TITLES} requiresOrganisation="Admin & Operations">
      {children}
    </WorkspaceShell>
  );
}

