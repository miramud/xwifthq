import {
  ArchiveRestore,
  ArrowLeftRight,
  Ban,
  BadgeCheck,
  CircleCheckBig,
  CircleDashed,
  CircleHelp,
  FilePen,
  Hourglass,
  PackageCheck,
  PackageOpen,
  ShieldAlert,
  ShoppingCart,
  Siren,
  Tag,
  Trash2,
  Truck,
  UserCheck,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import { humanise } from "@/suite/lms/components/ui/ws";
import type {
  AssetBook,
  AssetClass,
  AssetCondition,
  AssetRequestKind,
  AssetRequestStatus,
  AssetStatus,
  DisposalMethod,
  ExitItemStatus,
  VerificationResult,
} from "@/lib/api/operations-assets-client";

/* Every asset enum in the words of the person reading it, with its colour and icon. */

export type Meta = { label: string; hue: Hue; icon: LucideIcon };

const fallback = (s: string | null | undefined): Meta => ({ label: humanise(s ?? ""), hue: "slate", icon: CircleDashed });

export const ASSET_STATUS: Record<AssetStatus, Meta> = {
  received: { label: "Received, not tagged", hue: "sun", icon: Tag },
  in_store: { label: "In store", hue: "sky", icon: PackageCheck },
  allocated: { label: "Allocated", hue: "mint", icon: UserCheck },
  in_transit: { label: "In transit", hue: "grape", icon: Truck },
  under_maintenance: { label: "Under maintenance", hue: "coral", icon: Wrench },
  lost: { label: "Lost", hue: "rose", icon: CircleHelp },
  stolen: { label: "Stolen", hue: "rose", icon: Siren },
  disposal_pending: { label: "Disposal pending", hue: "slate", icon: Hourglass },
  disposed: { label: "Disposed", hue: "slate", icon: Trash2 },
};

/** The order the register reads an asset's life in. */
export const ASSET_STATUS_ORDER: AssetStatus[] = ["received", "in_store", "in_transit", "allocated", "under_maintenance", "lost", "stolen", "disposal_pending", "disposed"];

export const assetStatus = (s: string | null | undefined): Meta => ASSET_STATUS[s as AssetStatus] ?? fallback(s);

export const CONDITION: Record<AssetCondition, { label: string; hue: Hue; rank: number }> = {
  new: { label: "New", hue: "mint", rank: 0 },
  good: { label: "Good", hue: "sky", rank: 1 },
  fair: { label: "Fair", hue: "sun", rank: 2 },
  poor: { label: "Poor", hue: "coral", rank: 3 },
  faulty: { label: "Faulty", hue: "rose", rank: 4 },
  beyond_repair: { label: "Beyond repair", hue: "rose", rank: 5 },
};

export const CONDITION_ORDER: AssetCondition[] = ["new", "good", "fair", "poor", "faulty", "beyond_repair"];

export const condition = (c: string | null | undefined) => CONDITION[c as AssetCondition] ?? { label: humanise(c ?? ""), hue: "slate" as Hue, rank: 9 };

export const ASSET_CLASS: Record<AssetClass, string> = {
  ict: "ICT equipment",
  office_equipment: "Office equipment",
  furniture: "Furniture and fittings",
  vehicles: "Motor vehicles",
  buildings: "Buildings",
};

export const REQUEST_STATUS: Record<AssetRequestStatus, Meta> = {
  draft: { label: "Draft", hue: "slate", icon: FilePen },
  in_approval: { label: "In approval", hue: "grape", icon: Hourglass },
  approved: { label: "Approved, to fulfil", hue: "sky", icon: BadgeCheck },
  fulfilled: { label: "Fulfilled", hue: "mint", icon: CircleCheckBig },
  converted: { label: "Sent to procurement", hue: "blue", icon: ShoppingCart },
  rejected: { label: "Rejected", hue: "rose", icon: XCircle },
  cancelled: { label: "Cancelled", hue: "slate", icon: Ban },
};

export const requestStatus = (s: string | null | undefined): Meta => REQUEST_STATUS[s as AssetRequestStatus] ?? fallback(s);

export const REQUEST_KIND: Record<AssetRequestKind, Meta> = {
  allocation: { label: "New allocation", hue: "blue", icon: PackageOpen },
  onboarding: { label: "Onboarding kit", hue: "grape", icon: UserCheck },
  replacement: { label: "Replacement", hue: "coral", icon: Wrench },
  return: { label: "Return", hue: "sky", icon: ArchiveRestore },
  transfer: { label: "Transfer", hue: "mint", icon: ArrowLeftRight },
  take_out: { label: "Temporary take-out", hue: "sun", icon: Truck },
  disposal: { label: "Disposal", hue: "rose", icon: Trash2 },
};

export const requestKind = (k: string | null | undefined): Meta => REQUEST_KIND[k as AssetRequestKind] ?? fallback(k);

export const DISPOSAL: Record<DisposalMethod, string> = {
  sale: "Sale",
  scrap: "Scrap",
  donation: "Donation",
  write_off: "Write-off",
};

export const VERIFY_RESULT: Record<VerificationResult, Meta> = {
  verified: { label: "Verified", hue: "mint", icon: CircleCheckBig },
  mismatch: { label: "Found elsewhere", hue: "sun", icon: ArrowLeftRight },
  missing: { label: "Missing", hue: "rose", icon: ShieldAlert },
  pending: { label: "Not yet seen", hue: "slate", icon: CircleDashed },
};

export const verifyResult = (r: string | null | undefined): Meta => VERIFY_RESULT[r as VerificationResult] ?? fallback(r);

export const EXIT_ITEM: Record<ExitItemStatus, Meta> = {
  outstanding: { label: "Outstanding", hue: "sun", icon: Hourglass },
  returned: { label: "Returned", hue: "mint", icon: ArchiveRestore },
  deduct: { label: "Deduct from final pay", hue: "coral", icon: ShoppingCart },
  write_off: { label: "Written off", hue: "slate", icon: XCircle },
};

export const exitItem = (s: string | null | undefined): Meta => EXIT_ITEM[s as ExitItemStatus] ?? fallback(s);

/** What a history line says happened. */
export const MOVEMENT: Record<string, { label: string; hue: Hue; icon: LucideIcon }> = {
  tag: { label: "Tagged", hue: "sun", icon: Tag },
  allocate: { label: "Handed over", hue: "mint", icon: UserCheck },
  transfer: { label: "Transferred", hue: "grape", icon: ArrowLeftRight },
  return: { label: "Returned to store", hue: "sky", icon: ArchiveRestore },
  status: { label: "Status changed", hue: "coral", icon: Wrench },
  dispose: { label: "Disposed of", hue: "slate", icon: Trash2 },
  take_out: { label: "Taken out on a gate pass", hue: "sun", icon: Truck },
  check_in: { label: "Checked back in", hue: "sky", icon: PackageCheck },
};

export const movement = (k: string) => MOVEMENT[k] ?? { label: humanise(k), hue: "slate" as Hue, icon: CircleDashed };

/* ------------------------------ arithmetic ----------------------------- */

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Whole days from today to a `YYYY-MM-DD` date: negative when it has passed. */
export function daysFrom(today: string, date: string | null | undefined): number | null {
  if (!date) return null;
  const a = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  const b = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/** How much of the cost has been depreciated, 0-100. */
export function depreciatedPercent(book: Pick<AssetBook, "cost" | "accumulated"> | null): number {
  if (!book || book.cost <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((book.accumulated / book.cost) * 100)));
}

/** A disposal's expected gain (positive) or loss (negative): proceeds against Finance's net book value. */
export function expectedGainLoss(nbv: number | null | undefined, proceeds: number | null | undefined): number | null {
  if (nbv === null || nbv === undefined) return null;
  return (proceeds ?? 0) - nbv;
}

/** `2500` basis points as people say it: `25% a year`. */
export function rateText(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return "—";
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}% a year`;
}

/** An instant as `3 Oct 2026, 14:05`. */
export function stampOf(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
