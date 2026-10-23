import type { AuthUser } from "@/lib/auth-store";
import { holdsFeature } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";

/**
 * Admin & Operations features (`admin.{feature}.{action}` keys, from
 * `api-lms/app/Suite/Admin/Access/permissions.php`). The module key is
 * `admin`; the product and the API prefix are "operations".
 */
export type OperationsFeature =
  | "overview"
  | "purchase_requests"
  | "purchase_orders"
  | "receiving"
  | "travel_desk"
  | "events"
  | "client_payments"
  | "attachments"
  | "assets"
  | "asset_requests"
  | "asset_verification"
  | "exit_clearances"
  | "stores"
  | "compliance"
  | "maintenance"
  | "facilities"
  | "fleet"
  | "service_desk"
  | "correspondence";

/** May this person see an Operations desk? Admins, and holders of a key of the feature. */
export function mayUseOperations(user: AuthUser | null, ...features: OperationsFeature[]): boolean {
  if (!user) return false;
  if (isAdminRole(user)) return true;
  return holdsFeature(user, "admin", ...features);
}

/** Holds this exact action, e.g. `mayDoOps(u, "receiving", "approve_grn")`. Admins always. */
export function mayDoOps(user: AuthUser | null, feature: OperationsFeature, action: string): boolean {
  if (!user) return false;
  if (isAdminRole(user)) return true;
  return (user.permissions ?? []).includes(`admin.${feature}.${action}`);
}
