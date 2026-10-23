/* ------------------------------------------------------------------ */
/*  Browser-side client for the organisation's shared foundations      */
/*  (5 Oct 2026): profile, exchange rates, the unit tree and cost      */
/*  centres, clients & vendors, reference numbering, the approval      */
/*  setup, and issued documents. Same-origin /api/org proxy.           */
/*                                                                      */
/*  Lookups (`lookups.*`) are open to everybody in the organisation;   */
/*  everything else needs the organisation console.                    */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";
import type { Completion, ContextFieldDef, Delegation, RoutePreview, StageType } from "./approvals-client";

export { ApiError };

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/org/${path}`, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return {} as T;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors);
  }
  return json as T;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

/* ------------------------------ profile ----------------------------- */

export interface OrgProfile {
  legalName: string | null;
  tradingName: string | null;
  shortCode: string | null;
  rcNumber: string | null;
  tin: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  /** The whole address on one line, for display. */
  address: string | null;
  displayName: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  timezone: string;
  /** ISO weekdays the organisation works: 1 = Monday ... 7 = Sunday. */
  workingDays: number[];
  workStartsAt: string;
  workEndsAt: string;
  documentFooter: string | null;
  updatedAt: string | null;
}

/** One unit of `currency` = `rate` units of the organisation's base currency, on `asOf`. */
export interface FxRate {
  id: string;
  currency: string;
  baseCurrency: string;
  rate: string;
  asOf: string;
  source: string | null;
}

/* ----------------------------- structure ---------------------------- */

export interface UnitHead {
  id: string;
  userId: string;
  name: string | null;
  role: "head" | "deputy" | "acting";
  startsOn: string;
  endsOn?: string | null;
  isCurrent?: boolean;
}

export interface OrgUnit {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  kind: string;
  description: string | null;
  status: "active" | "retired";
  depth: number;
  sortOrder: number;
  memberCount: number | null;
  defaultCostCentre: { id: string; code: string; name: string } | null;
  head: UnitHead | null;
  heads: UnitHead[];
}

export interface CostCentre {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "closed";
  isOpen: boolean;
  orgUnit: { id: string; code: string; name: string } | null;
  budgetHolder: { id: string; name: string } | null;
  validFrom: string | null;
  validTo: string | null;
}

/* --------------------------- counterparties ------------------------- */

export type CounterpartyRole = "client" | "vendor" | "partner" | "subcontractor" | "regulator";

export interface CounterpartySummary {
  id: string;
  code: string | null;
  /** Printed in reference numbers as {CLIENT}; null means the initials are used. */
  shortCode?: string | null;
  slug: string;
  name: string;
  legalName: string | null;
  kind: "organisation" | "individual" | "government";
  roles: CounterpartyRole[];
  status: "active" | "former" | "blocked";
  kycStatus: "not_started" | "pending" | "verified" | "rejected";
  sector: string | null;
  defaultCurrency: string | null;
  activeAccounts: number;
  pendingAccounts: number;
}

export interface BankAccount {
  id: string;
  bankName: string;
  bankCode: string | null;
  accountName: string;
  /** Masked: "•••• 5678". The full number never leaves the server. */
  number: string;
  currency: string;
  isDefault: boolean;
  status: "pending_approval" | "active" | "rejected" | "retired";
  requestedBy: { id: string; name: string } | null;
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  requestedAt: string | null;
}

export interface Counterparty {
  id: string;
  code: string | null;
  /** Printed in reference numbers as {CLIENT}; null means the initials are used. */
  shortCode?: string | null;
  slug: string;
  roles: CounterpartyRole[];
  kind: "organisation" | "individual" | "government";
  name: string;
  legalName: string | null;
  website: string | null;
  sector: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  tin: string | null;
  rcNumber: string | null;
  vatNumber: string | null;
  defaultCurrency: string | null;
  paymentTermsDays: number | null;
  notes: string | null;
  status: "active" | "former" | "blocked";
  kycStatus: "not_started" | "pending" | "verified" | "rejected";
  aliases: { id: string; alias: string }[];
  /** The people there, primary first. */
  contacts: CounterpartyContact[];
  bankAccounts: BankAccount[];
  createdAt: string | null;
  /** New bank details are decided in Approvals (the default), not on this page. */
  bankChangesViaApprovals: boolean;
}

export type CounterpartyInput = Partial<Omit<Counterparty, "id" | "code" | "slug" | "aliases" | "contacts" | "bankAccounts" | "createdAt" | "bankChangesViaApprovals">>;

/** What a contact is the person to talk to about. */
export type ContactPurpose = "sales" | "accounts" | "remittance" | "technical" | "operations" | "management";

export const CONTACT_PURPOSES: { value: ContactPurpose; label: string }[] = [
  { value: "accounts", label: "Accounts" },
  { value: "remittance", label: "Remittance" },
  { value: "sales", label: "Sales" },
  { value: "technical", label: "Technical" },
  { value: "operations", label: "Operations" },
  { value: "management", label: "Management" },
];

/** A person at a client or vendor. One per counterparty is primary: the "Send to". */
export interface CounterpartyContact {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  purposes: ContactPurpose[];
  isPrimary: boolean;
  notes: string | null;
  active: boolean;
}

export interface ContactInput {
  name?: string;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  purposes?: ContactPurpose[];
  notes?: string | null;
  active?: boolean;
  isPrimary?: boolean;
}

/** The read-only view everybody in the organisation gets (lookup). */
export type ContactCard = Pick<CounterpartyContact, "id" | "name" | "jobTitle" | "email" | "phone" | "purposes" | "isPrimary">;

/* ----------------------------- numbering ---------------------------- */

export interface NumberSeries {
  id: string;
  code: string;
  name: string;
  format: string;
  reset: "never" | "yearly" | "fiscal_yearly" | "monthly";
  startAt: number;
  active: boolean;
  /** What the next number would look like. */
  preview: string;
  issued: number;
  voided: number;
}

/* ----------------------------- approvals ---------------------------- */

export type ResolverSpec = { kind: string; [param: string]: string | undefined };

export type Condition =
  | { always: boolean }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { field: string; op: string; value: unknown };

export interface StageSpec {
  key: string;
  name: string;
  order: number;
  type: StageType;
  completion: Completion;
  quorum: number | null;
  resolver: ResolverSpec;
  fallback: ResolverSpec | null;
  slaHours: number | null;
  parallelGroup: string | null;
  distinctPerson: boolean;
  canAmend: string[];
}

export interface PolicyRule {
  id: string;
  label: string;
  when: Condition;
  stages: StageSpec[];
}

export interface PolicyDefinition {
  schema: 1;
  rules: PolicyRule[];
  bypass: { id: string; label: string; when: Condition }[];
  fallback?: ResolverSpec | null;
  independent?: ResolverSpec | null;
  splitting: { enabled: boolean; windowDays: number };
}

export interface ProcessSetup {
  code: string;
  name: string;
  description: string;
  module: string;
  enabled: boolean;
  settings: { slaHours: number; splitWindowDays: number };
  activeVersion: number | null;
  usingDefault: boolean;
  draftVersion: number | null;
  pendingVersion: number | null;
  controlStages: { key: string; name: string; who: string }[];
  openRequests: number;
  /** Fields rules may test, and the ones an approver may lower. */
  fields: ContextFieldDef[];
  amendable: string[];
  draftPolicyId: string | null;
  pendingPolicyId: string | null;
  templates: { key: string; name: string; description: string }[];
}

export interface ResolverInfo {
  kind: string;
  label: string;
  /** param name => type (role, user, unit, committee). */
  params: Record<string, string>;
}

export interface PolicySummary {
  id: string;
  process: string;
  processName: string;
  version: number;
  status: "draft" | "pending_approval" | "active" | "superseded" | "rejected";
  effectiveFrom: string | null;
  templateKey: string | null;
  notes: string | null;
  ruleCount: number;
  createdBy: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  changeInstanceId: string | null;
}

export interface PolicyDetail extends PolicySummary {
  definition: PolicyDefinition;
  templates?: { key: string; name: string; description: string }[];
  /** Missing roles etc. when a draft was started from a template. */
  problems?: Record<string, string[]>;
}

export interface ApprovalRoleHolder {
  id: string;
  type: "user" | "job_title" | "unit_head" | "access_role";
  holderId: string;
  label: string;
  unitId: string | null;
  unit: string | null;
  validFrom: string | null;
  validTo: string | null;
  current: boolean;
}

export interface ApprovalRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parent: { id: string; code: string; name: string } | null;
  holders: ApprovalRoleHolder[];
  currentPeople: { id: string; name: string }[];
  vacant: boolean;
}

export interface AuthorityLimit {
  id: string;
  user: { id: string; name: string } | null;
  role: { id: string; code: string; name: string } | null;
  process: string | null;
  maxAmount: number;
  validFrom: string | null;
  validTo: string | null;
}

export interface Committee {
  id: string;
  code: string;
  name: string;
  quorum: number;
  members: { id: string; name: string | null }[];
}

/** Organisation › Approvals › the authenticator-code (step-up) amount. */
export interface StepUpSetting {
  /** Minor units; null = off. */
  amount: number | null;
  currency: string;
  baseCurrency: string;
  /** People in the organisation with an authenticator app set up, of `people`. */
  enrolled: number;
  people: number;
  /** Open approval tasks that need a code right now. */
  waiting: number;
}

export interface DoaMatrix {
  organisation: string;
  currency: string;
  generatedAt: string;
  sections: {
    code: string;
    name: string;
    version: number | null;
    effectiveFrom: string | null;
    rules: { rule: string; when: string; stages: { name: string; who: string; type: StageType; order: number }[] }[];
    controls: { name: string; who: string }[];
    bypass: { label: string; when: string }[];
  }[];
  limits: { who: string; process: string; maxAmount: number; validFrom: string | null; validTo: string | null }[];
}

export interface OversightRow {
  id: string;
  process: string;
  processName: string;
  title: string;
  ref: string | null;
  status: string;
  amount: number | null;
  currency: string | null;
  flags: string[];
  requester: string | null;
  submittedAt: string;
  stages: { name: string; dueAt: string | null; overdue: boolean; waitingOn: { taskId: string; name: string | null }[] }[];
}

export interface IssuedDocument {
  id: string;
  kind: string;
  title: string;
  reference: string | null;
  issuedAt: string;
  issuedBy: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  sha256: string | null;
  /** The QR's token: `/verify/d/{token}` is the public check page. */
  token: string;
}

/* ------------------------------ client ------------------------------ */

export const orgFoundations = {
  profile: {
    get: () => data(request<{ data: OrgProfile }>("profile")),
    update: (patch: Partial<Omit<OrgProfile, "address" | "displayName" | "updatedAt">>) => data(request<{ data: OrgProfile }>("profile", { method: "PATCH", body: patch })),
  },

  fxRates: {
    list: (currency?: string) => request<{ data: FxRate[]; meta: { baseCurrency: string } }>(`fx-rates${currency ? `?currency=${currency}` : ""}`),
    /** `rate` as decimal text ("1545.25"), never a float. */
    create: (input: { currency: string; rate: string; asOf?: string }) =>
      data(request<{ data: FxRate }>("fx-rates", { method: "POST", body: input })),
    remove: (id: string) => request<unknown>(`fx-rates/${id}`, { method: "DELETE" }),
  },

  units: {
    tree: (includeRetired = false) => data(request<{ data: OrgUnit[] }>(`units${includeRetired ? "?includeRetired=1" : ""}`)),
    create: (input: { code: string; name: string; kind?: string; parentId?: string | null; description?: string | null; defaultCostCentreId?: string | null }) =>
      data(request<{ data: OrgUnit }>("units", { method: "POST", body: input })),
    update: (id: string, patch: { code?: string; name?: string; kind?: string; description?: string | null; defaultCostCentreId?: string | null; status?: "active" | "retired" }) =>
      data(request<{ data: OrgUnit }>(`units/${id}`, { method: "PATCH", body: patch })),
    move: (id: string, parentId: string | null) => data(request<{ data: OrgUnit }>(`units/${id}/move`, { method: "POST", body: { parentId } })),
    remove: (id: string) => request<unknown>(`units/${id}`, { method: "DELETE" }),
    assignHead: (id: string, input: { userId: string; role?: "head" | "deputy" | "acting"; startsOn?: string; endsOn?: string | null }) =>
      data(request<{ data: OrgUnit }>(`units/${id}/heads`, { method: "POST", body: input })),
    endHead: (id: string, headId: string, endsOn?: string) =>
      data(request<{ data: OrgUnit }>(`units/${id}/heads/${headId}/end`, { method: "POST", body: { endsOn } })),
    addMembers: (id: string, userIds: string[]) =>
      data(request<{ data: { moved: number } }>(`units/${id}/members`, { method: "POST", body: { userIds } })),
  },

  costCentres: {
    list: () => data(request<{ data: CostCentre[] }>("cost-centres")),
    create: (input: { code: string; name: string; description?: string | null; orgUnitId?: string | null; budgetHolderId?: string | null; validFrom?: string | null; validTo?: string | null }) =>
      data(request<{ data: CostCentre }>("cost-centres", { method: "POST", body: input })),
    update: (id: string, patch: Partial<{ code: string; name: string; description: string | null; orgUnitId: string | null; budgetHolderId: string | null; status: "active" | "closed"; validFrom: string | null; validTo: string | null }>) =>
      data(request<{ data: CostCentre }>(`cost-centres/${id}`, { method: "PATCH", body: patch })),
    remove: (id: string) => request<unknown>(`cost-centres/${id}`, { method: "DELETE" }),
  },

  counterparties: {
    list: (filters: { role?: CounterpartyRole; status?: string; q?: string } = {}) => {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
      return data(request<{ data: CounterpartySummary[] }>(`counterparties${qs ? `?${qs}` : ""}`));
    },
    get: (id: string) => data(request<{ data: Counterparty }>(`counterparties/${id}`)),
    create: (input: CounterpartyInput & { name: string; roles: CounterpartyRole[] }) =>
      data(request<{ data: Counterparty }>("counterparties", { method: "POST", body: input })),
    update: (id: string, patch: CounterpartyInput) => data(request<{ data: Counterparty }>(`counterparties/${id}`, { method: "PATCH", body: patch })),
    remove: (id: string) => request<unknown>(`counterparties/${id}`, { method: "DELETE" }),
    setRoles: (id: string, roles: CounterpartyRole[]) => data(request<{ data: Counterparty }>(`counterparties/${id}/roles`, { method: "PUT", body: { roles } })),
    addAlias: (id: string, alias: string) => data(request<{ data: Counterparty }>(`counterparties/${id}/aliases`, { method: "POST", body: { alias } })),
    removeAlias: (id: string, aliasId: string) => request<unknown>(`counterparties/${id}/aliases/${aliasId}`, { method: "DELETE" }),
    addContact: (id: string, input: ContactInput & { name: string }) =>
      data(request<{ data: Counterparty }>(`counterparties/${id}/contacts`, { method: "POST", body: input })),
    updateContact: (id: string, contactId: string, patch: ContactInput) =>
      data(request<{ data: Counterparty }>(`counterparties/${id}/contacts/${contactId}`, { method: "PATCH", body: patch })),
    makePrimaryContact: (id: string, contactId: string) =>
      data(request<{ data: Counterparty }>(`counterparties/${id}/contacts/${contactId}/primary`, { method: "POST" })),
    removeContact: (id: string, contactId: string) =>
      data(request<{ data: Counterparty }>(`counterparties/${id}/contacts/${contactId}`, { method: "DELETE" })),
    requestBankAccount: (id: string, input: { bankName: string; bankCode?: string | null; accountName: string; accountNumber: string; currency?: string | null }) =>
      data(request<{ data: Counterparty }>(`counterparties/${id}/bank-accounts`, { method: "POST", body: input })),
    approveBankAccount: (id: string, accountId: string) =>
      data(request<{ data: Counterparty }>(`counterparties/${id}/bank-accounts/${accountId}/approve`, { method: "POST" })),
    rejectBankAccount: (id: string, accountId: string, reason: string) =>
      data(request<{ data: Counterparty }>(`counterparties/${id}/bank-accounts/${accountId}/reject`, { method: "POST", body: { reason } })),
    retireBankAccount: (id: string, accountId: string) =>
      data(request<{ data: Counterparty }>(`counterparties/${id}/bank-accounts/${accountId}/retire`, { method: "POST" })),
  },

  numbering: {
    list: () => data(request<{ data: NumberSeries[] }>("number-series")),
    update: (id: string, patch: { name?: string; format?: string; reset?: NumberSeries["reset"]; startAt?: number }) =>
      data(request<{ data: Pick<NumberSeries, "id" | "code" | "format" | "reset" | "preview"> }>(`number-series/${id}`, { method: "PATCH", body: patch })),
    preview: (format: string) => data(request<{ data: { preview: string; reset: NumberSeries["reset"] } }>("number-series/preview", { method: "POST", body: { format } })),
  },

  approvals: {
    /** `meta.soleAdmin`: a policy change here takes effect at once (nobody else to approve it). */
    processes: () => request<{ data: ProcessSetup[]; meta: { soleAdmin: boolean }; resolvers: ResolverInfo[] }>("approvals/processes"),
    updateProcess: (code: string, patch: { enabled?: boolean; slaHours?: number; splitWindowDays?: number }) =>
      data(request<{ data: { code: string; enabled: boolean } }>(`approvals/processes/${encodeURIComponent(code)}`, { method: "PATCH", body: patch })),

    policies: (process?: string) => data(request<{ data: PolicySummary[] }>(`approvals/policies${process ? `?process=${encodeURIComponent(process)}` : ""}`)),
    policy: (id: string) => data(request<{ data: PolicyDetail }>(`approvals/policies/${id}`)),
    /** `from`: "active" (default), "default", or "template:<key>". */
    newDraft: (process: string, from?: string) => data(request<{ data: PolicyDetail }>("approvals/policies", { method: "POST", body: { process, from } })),
    saveDraft: (id: string, patch: { definition?: PolicyDefinition; effectiveFrom?: string | null; notes?: string | null }) =>
      data(request<{ data: PolicyDetail }>(`approvals/policies/${id}`, { method: "PATCH", body: patch })),
    discardDraft: (id: string) => request<unknown>(`approvals/policies/${id}`, { method: "DELETE" }),
    /** `definition`: unsaved edits to try instead of the stored version (never saved). */
    simulate: (id: string, requesterId: string, context: Record<string, unknown>, definition?: PolicyDefinition) =>
      data(request<{ data: RoutePreview }>(`approvals/policies/${id}/simulate`, { method: "POST", body: { requesterId, context, definition } })),
    submit: (id: string) => data(request<{ data: PolicySummary }>(`approvals/policies/${id}/submit`, { method: "POST" })),

    roles: {
      list: () => data(request<{ data: ApprovalRole[] }>("approvals/roles")),
      create: (input: { code: string; name: string; description?: string | null; parentId?: string | null }) =>
        data(request<{ data: ApprovalRole }>("approvals/roles", { method: "POST", body: input })),
      update: (id: string, patch: { name?: string; description?: string | null; parentId?: string | null }) =>
        data(request<{ data: ApprovalRole }>(`approvals/roles/${id}`, { method: "PATCH", body: patch })),
      remove: (id: string) => request<unknown>(`approvals/roles/${id}`, { method: "DELETE" }),
      addHolder: (id: string, input: { type: ApprovalRoleHolder["type"]; holderId: string; unitId?: string | null; validFrom?: string | null; validTo?: string | null }) =>
        data(request<{ data: ApprovalRole }>(`approvals/roles/${id}/holders`, { method: "POST", body: input })),
      removeHolder: (id: string, holderId: string) => data(request<{ data: ApprovalRole }>(`approvals/roles/${id}/holders/${holderId}`, { method: "DELETE" })),
    },

    limits: {
      list: () => data(request<{ data: AuthorityLimit[] }>("approvals/limits")),
      create: (input: { userId?: string | null; roleId?: string | null; process?: string | null; maxAmount: number; validFrom?: string | null; validTo?: string | null }) =>
        data(request<{ data: AuthorityLimit }>("approvals/limits", { method: "POST", body: input })),
      update: (id: string, input: { userId?: string | null; roleId?: string | null; process?: string | null; maxAmount: number; validFrom?: string | null; validTo?: string | null }) =>
        data(request<{ data: AuthorityLimit }>(`approvals/limits/${id}`, { method: "PATCH", body: input })),
      remove: (id: string) => request<unknown>(`approvals/limits/${id}`, { method: "DELETE" }),
    },

    committees: {
      list: () => data(request<{ data: Committee[] }>("approvals/committees")),
      create: (input: { code: string; name: string; quorum: number; memberIds?: string[] }) =>
        data(request<{ data: Committee }>("approvals/committees", { method: "POST", body: input })),
      update: (id: string, patch: { name?: string; quorum?: number; memberIds?: string[] }) =>
        data(request<{ data: Committee }>(`approvals/committees/${id}`, { method: "PATCH", body: patch })),
      remove: (id: string) => request<unknown>(`approvals/committees/${id}`, { method: "DELETE" }),
    },

    delegations: {
      list: () => data(request<{ data: Delegation[] }>("approvals/delegations")),
      create: (input: { delegatorId: string; delegateId: string; startsAt: string; endsAt: string; processes?: string[] | null; maxAmount?: number | null; reason?: string | null }) =>
        data(request<{ data: Delegation }>("approvals/delegations", { method: "POST", body: input })),
      revoke: (id: string) => data(request<{ data: Delegation }>(`approvals/delegations/${id}/revoke`, { method: "POST" })),
    },

    /** The step-up amount: at or above it, approving needs an authenticator code. */
    stepUp: () => data(request<{ data: StepUpSetting }>("approvals/step-up")),
    /** `amount: null` switches it off. */
    updateStepUp: (amount: number | null, currency?: string) =>
      data(request<{ data: StepUpSetting }>("approvals/step-up", { method: "PUT", body: { amount, currency: amount === null ? null : currency } })),

    doa: () => data(request<{ data: DoaMatrix }>("approvals/doa")),
    doaPdfUrl: () => "/api/org/approvals/doa/pdf",

    oversight: (filters: { status?: string; process?: string; q?: string } = {}) => {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
      return data(request<{ data: OversightRow[] }>(`approvals/oversight${qs ? `?${qs}` : ""}`));
    },
    reroute: (instanceId: string) => data(request<{ data: { status: string } }>(`approvals/oversight/${instanceId}/reroute`, { method: "POST" })),
    reassign: (taskId: string, userId: string, reason: string) =>
      request<unknown>(`approvals/tasks/${taskId}/reassign`, { method: "POST", body: { userId, reason } }),
  },

  documents: {
    list: (filters: { kind?: string; q?: string } = {}) => {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
      return data(request<{ data: IssuedDocument[] }>(`documents${qs ? `?${qs}` : ""}`));
    },
    revoke: (id: string, reason: string) => data(request<{ data: { id: string; revokedAt: string } }>(`documents/${id}/revoke`, { method: "POST", body: { reason } })),
  },

  /** Pickers every module's forms read - open to anybody in the organisation. */
  lookups: {
    /** Colleagues for people pickers: name, job title and unit, nothing else. */
    people: (q?: string) =>
      data(request<{ data: { id: string; name: string; jobTitle: string | null; unit: string | null }[] }>(`lookups/people${q ? `?q=${encodeURIComponent(q)}` : ""}`)),
    units: () => data(request<{ data: { id: string; parentId: string | null; code: string; name: string; kind: string; depth: number; defaultCostCentreId: string | null }[] }>("lookups/units")),
    costCentres: () => data(request<{ data: { id: string; code: string; name: string; orgUnitId: string | null }[] }>("lookups/cost-centres")),
    counterparties: (filters: { role?: CounterpartyRole; q?: string } = {}) => {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
      return data(request<{ data: { id: string; code: string | null; name: string; roles: CounterpartyRole[] }[] }>(`lookups/counterparties${qs ? `?${qs}` : ""}`));
    },
    /** Active contacts at a client or vendor, primary first (read-only, anybody in the organisation). */
    counterpartyContacts: (counterpartyId: string) =>
      data(request<{ data: ContactCard[] }>(`lookups/counterparties/${encodeURIComponent(counterpartyId)}/contacts`)),
  },
};

export type { ContextFieldDef };
