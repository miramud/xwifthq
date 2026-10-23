"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  Code2,
  Inbox,
  Mail,
  Phone,
  Save,
  Server,
  Trash2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Segmented, Toolbar } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import type { Hue } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, labelClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import {
  ApiError,
  SALES_REQUEST_STATUS_LABEL,
  SALES_REQUEST_TYPE_LABEL,
  platformSalesRequests,
  type SalesRequest,
  type SalesRequestPage,
  type SalesRequestStatus,
  type SalesRequestType,
} from "@/lib/api/platform-billing-client";
import { MODULE_LABEL, type SuiteModuleKey } from "@/lib/module-access";
import { LoadError, ModuleChip, Notice, Pager, When } from "../ui";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

export const REQUEST_STATUS_HUE: Record<SalesRequestStatus, Hue> = {
  new: "sun",
  contacted: "sky",
  won: "mint",
  lost: "slate",
};

const TYPE_LOOK: Record<SalesRequestType, { icon: LucideIcon; hue: Hue }> = {
  source_code: { icon: Code2, hue: "grape" },
  dedicated_hosting: { icon: Server, hue: "sky" },
  enterprise: { icon: Building2, hue: "coral" },
  licence: { icon: BadgeCheck, hue: "blue" },
};

function moduleName(key: string): string {
  return MODULE_LABEL[key as SuiteModuleKey] ?? key.toUpperCase();
}

/** "3 modules: HR, Projects, Learning" — or null when the request names none. */
function modulesAsked(r: SalesRequest): string | null {
  const keys = r.modules ?? [];
  const count = r.moduleCount ?? (keys.length || null);
  if (count === null) return null;
  return `${count} module${count === 1 ? "" : "s"}${keys.length ? `: ${keys.map(moduleName).join(", ")}` : ""}`;
}

const STATUS_FILTERS: { key: SalesRequestStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

const TYPE_FILTERS: { key: SalesRequestType | ""; label: string }[] = [
  { key: "", label: "Every type" },
  { key: "source_code", label: "Source code" },
  { key: "dedicated_hosting", label: "Dedicated server" },
  { key: "enterprise", label: "Enterprise" },
  { key: "licence", label: "Module licence" },
];

function isStatus(v: string | null | undefined): v is SalesRequestStatus {
  return v === "new" || v === "contacted" || v === "won" || v === "lost";
}

function typeLabel(t: string): string {
  return SALES_REQUEST_TYPE_LABEL[t as SalesRequestType] ?? t;
}

/**
 * Sales requests: people asking, from the public pricing page, to buy the full
 * source code, a dedicated server with a custom domain, or an enterprise
 * arrangement. None of these is a card checkout — the team contacts them,
 * agrees terms and invoices (the owner's ruling of 26 September 2026) — so
 * this page is a small pipeline: who asked, how to reach them, where it
 * stands, and the team's notes. A request removed here goes to the platform's
 * recycle bin, never straight out of existence.
 *
 * Module licence requests (27 Sep 2026) name the modules wanted. When an
 * existing organisation asked from its billing page, the request carries its
 * id and the detail links to it, so the owner can record the licence there.
 */
export default function SalesRequestsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const initialStatus = search?.get("status");

  const [status, setStatus] = useState<SalesRequestStatus | "">(isStatus(initialStatus) ? initialStatus : "");
  const [type, setType] = useState<SalesRequestType | "">("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<SalesRequestPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<SalesRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    platformSalesRequests
      .list({ status: status || undefined, type: type || undefined, page })
      .then((r) => {
        setList(r);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Sales requests didn't load."));
  }, [status, type, page]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatusFilter = (v: SalesRequestStatus | "") => {
    setStatus(v);
    setPage(1);
    router.replace(v ? `${pathname}?status=${v}` : (pathname ?? "/suite/platform/sales-requests"));
  };

  const replaceRow = (row: SalesRequest) => {
    setList((l) => (l ? { ...l, data: l.data.map((r) => (r.id === row.id ? row : r)) } : l));
    setOpen(row);
  };

  const removed = (row: SalesRequest) => {
    setOpen(null);
    setNotice(`${row.name}'s request moved to the recycle bin.`);
    load();
  };

  const columns: Column<SalesRequest>[] = [
    {
      key: "who",
      header: "Request",
      primary: true,
      value: (r) => r.name,
      render: (r) => {
        const look = TYPE_LOOK[r.type as SalesRequestType] ?? { icon: Sparkles, hue: "slate" as Hue };
        const Icon = look.icon;
        return (
          <button
            type="button"
            onClick={() => setOpen(r)}
            className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <Chip hue={look.hue} icon={Icon}>
              {typeLabel(r.type)}
            </Chip>
            <span className="min-w-0">
              <span className="block truncate font-medium text-neutral-900 hover:text-primary-700">{r.name}</span>
              <span className="block truncate text-xs text-neutral-500">
                {r.organisationName ?? r.email}
                {r.organisationId && " · existing organisation"}
              </span>
              {modulesAsked(r) && <span className="block truncate text-xs text-neutral-600">{modulesAsked(r)}</span>}
            </span>
          </button>
        );
      },
    },
    {
      key: "contact",
      header: "Contact",
      hideOnMobile: true,
      value: (r) => r.email,
      render: (r) => (
        <span className="min-w-0 text-sm">
          <span className="block truncate text-neutral-700">{r.email}</span>
          <span className="block truncate text-xs text-neutral-500">{r.phone ?? "No phone given"}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      render: (r) => (
        <Chip hue={REQUEST_STATUS_HUE[r.status] ?? "slate"} dot>
          {SALES_REQUEST_STATUS_LABEL[r.status] ?? r.status}
        </Chip>
      ),
    },
    {
      key: "created",
      header: "Asked",
      align: "right",
      value: (r) => r.createdAt,
      render: (r) => <When at={r.createdAt} className="whitespace-nowrap text-neutral-600" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commerce"
        title="Sales requests"
        subtitle="Source code, dedicated servers, enterprise asks and module licences. The team follows up, invoices, and records licences on the organisation."
      />

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}

      <Toolbar>
        <Segmented label="Status" value={status} onChange={changeStatusFilter} options={STATUS_FILTERS} />
        <Segmented
          label="Type"
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={TYPE_FILTERS}
        />
      </Toolbar>

      {error ? (
        <LoadError
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      ) : !list ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <DataView
            rows={list.data}
            columns={columns}
            rowKey={(r) => r.id}
            storageKey="platform.sales-requests"
            caption="Sales requests"
            searchable={false}
            empty={
              <Card>
                <Empty
                  icon={Inbox}
                  title={status || type ? "Nothing matches these filters" : "No sales requests yet"}
                  hint={
                    status || type
                      ? "Try another status or type."
                      : "When someone asks for the source code or a dedicated server on the pricing page, it lands here."
                  }
                />
              </Card>
            }
          />
          <Pager page={list.meta.currentPage} lastPage={list.meta.lastPage} total={list.meta.total} onPage={setPage} noun="requests" />
        </>
      )}

      {open && <RequestDetail request={open} onClose={() => setOpen(null)} onSaved={replaceRow} onRemoved={removed} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  One request                                                        */
/* ------------------------------------------------------------------ */

export function RequestDetail({
  request,
  onClose,
  onSaved,
  onRemoved,
}: {
  request: SalesRequest;
  onClose: () => void;
  onSaved: (row: SalesRequest) => void;
  onRemoved: (row: SalesRequest) => void;
}) {
  const id = useId();
  const confirm = useConfirm();
  const [status, setStatus] = useState<SalesRequestStatus>(request.status);
  const [notes, setNotes] = useState(request.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // An existing organisation that asked links to its Modules tab, to license from there.
  const orgSlug = request.organisation?.slug ?? null;

  const dirty = status !== request.status || notes.trim() !== (request.notes ?? "").trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      const row = await platformSalesRequests.update(request.id, { status, notes: notes.trim() === "" ? null : notes.trim() });
      setSaved(true);
      onSaved(row);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The request wasn't updated.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${request.name}'s request?`,
      recoverable: true,
      body: "It moves to the platform's recycle bin, where it can be restored.",
      confirmLabel: "Delete request",
    });
    if (!ok) return;
    try {
      await platformSalesRequests.remove(request.id);
      onRemoved(request);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The request wasn't deleted.");
    }
  }

  return (
    <DialogFrame
      as="form"
      onSubmit={save}
      titleId={`${id}-title`}
      title={request.name}
      subtitle={`${typeLabel(request.type)}${request.organisationName ? ` · ${request.organisationName}` : ""}`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button variant="ghost" icon={Trash2} onClick={remove} className="text-error-700 hover:bg-error-50 sm:mr-auto">
            Delete
          </Button>
          <Button onClick={onClose}>Close</Button>
          <Button type="submit" variant="primary" icon={Save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-neutral-500">Email</dt>
          <dd className="mt-0.5">
            <a href={`mailto:${request.email}`} className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:underline">
              <Mail size={14} aria-hidden />
              {request.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-500">Phone</dt>
          <dd className="mt-0.5">
            {request.phone ? (
              <a href={`tel:${request.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:underline">
                <Phone size={14} aria-hidden />
                {request.phone}
              </a>
            ) : (
              <span className="text-neutral-500">Not given</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-500">Organisation</dt>
          <dd className="mt-0.5 text-neutral-900">
            {orgSlug ? (
              <Link
                href={`/suite/platform/organisations/${encodeURIComponent(orgSlug)}?tab=modules`}
                className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:underline"
              >
                <Building2 size={14} aria-hidden />
                {request.organisationName}
              </Link>
            ) : (
              (request.organisationName ?? "-")
            )}
            {request.organisationId && (
              <span className="mt-1 block">
                <Chip hue="mint" dot>
                  Existing organisation
                </Chip>
              </span>
            )}
          </dd>
        </div>
        {Boolean(request.modules?.length || request.moduleCount) && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold text-neutral-500">Modules asked for</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5">
              {(request.modules ?? []).map((m) => (
                <ModuleChip key={m} moduleKey={m} label={moduleName(m)} />
              ))}
              {request.moduleCount != null && (
                <span className="text-sm tabular-nums text-neutral-600">
                  {request.moduleCount} module{request.moduleCount === 1 ? "" : "s"} in all
                </span>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-semibold text-neutral-500">Prefers to pay in</dt>
          <dd className="mt-0.5 text-neutral-900">{request.currency ?? "Not said"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold text-neutral-500">Asked</dt>
          <dd className="mt-0.5 text-neutral-900">
            <When at={request.createdAt} />
          </dd>
        </div>
      </dl>

      <div>
        <p className="text-xs font-semibold text-neutral-500">Their message</p>
        <p className="mt-1 whitespace-pre-line rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          {request.message?.trim() ? request.message : "No message."}
        </p>
      </div>

      <div>
        <p id={`${id}-status`} className={labelClass}>
          Status
        </p>
        <Segmented
          label="Request status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setSaved(false);
          }}
          options={(Object.keys(SALES_REQUEST_STATUS_LABEL) as SalesRequestStatus[]).map((s) => ({
            key: s,
            label: SALES_REQUEST_STATUS_LABEL[s],
          }))}
        />
      </div>

      <div>
        <label htmlFor={`${id}-notes`} className={labelClass}>
          Team notes
        </label>
        <RichTextEditor id={`${id}-notes`} minHeight={128} value={notes} onChange={(html) => {
            setNotes(html);
            setSaved(false);
          }} placeholder="Call outcomes, terms agreed, invoice number…" />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {saved && !dirty && (
        <p role="status" className="text-sm font-medium text-mint-700">
          Saved.
        </p>
      )}
    </DialogFrame>
  );
}
