"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, CheckCircle2, Plus, Users, BookOpen, Ban, RotateCcw, GraduationCap } from "lucide-react";
import {
  organisations as api,
  ApiError,
  type Organisation,
  type NewOrganisation,
} from "@/lib/api/saas-client";
import { useAuth } from "@/lib/auth-store";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Segmented, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ErrorNote, hintClass, inputClass, labelClass, StatCard } from "@/suite/lms/components/ui/ws";
import { DialogFrame, OrgMark, SeatMeter } from "@/suite/org/components/ui";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { platformModules, platformOrganisations, type PlatformModule } from "@/lib/api/platform-client";
import { canPlatform, PERM } from "@/suite/platform/access";
import { ModuleChip } from "@/suite/platform/components/ui";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";

type StatusFilter = "all" | "active" | "suspended";

/**
 * Tenant management — the platform owner's console.
 *
 * Institution admins never see this page (the nav hides it and the API refuses
 * them), so the screen assumes a cross-tenant view throughout: every figure is
 * "across all organisations", and every row is somebody else's institution.
 *
 * Seat usage is the number that matters commercially, so it is the one given a
 * meter rather than a bare count — an organisation at 198/200 needs to be
 * visible at a glance, not read off two columns.
 */
export default function OrganisationsList() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const search = useSearchParams();

  const [items, setItems] = useState<Organisation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(() => search?.get("new") === "1");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [moduleKey, setModuleKey] = useState("");
  const [modules, setModules] = useState<PlatformModule[]>([]);

  const isPlatformOwner = canPlatform(user, PERM.organisationsView);
  const canManage = canPlatform(user, PERM.organisationsManage);

  const load = useCallback(() => {
    api
      .list(moduleKey ? `?module=${encodeURIComponent(moduleKey)}` : "")
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load organisations."),
      );
  }, [moduleKey]);

  // The module filter's options. Optional: without them the filter hides.
  useEffect(() => {
    if (!isPlatformOwner) return;
    platformModules
      .list()
      .then((m) => setModules(m.filter((x) => x.key !== "core")))
      .catch(() => setModules([]));
  }, [isPlatformOwner]);

  // Don't fetch for an account the API will refuse. It would only ever 403,
  // and the screen below already explains why they are not here.
  useEffect(() => {
    if (isPlatformOwner) load();
  }, [isPlatformOwner, load]);

  const totals = useMemo(
    () => ({
      organisations: items?.length ?? 0,
      learners: items?.reduce((sum, o) => sum + (o.studentCount ?? 0), 0) ?? 0,
      courses: items?.reduce((sum, o) => sum + (o.courseCount ?? 0), 0) ?? 0,
    }),
    [items],
  );

  const shown = useMemo(
    () => (items ?? []).filter((o) => status === "all" || o.status === status),
    [items, status],
  );

  async function toggleStatus(organisation: Organisation) {
    if (
      organisation.status === "active" &&
      !(await confirm({
        title: `Suspend ${organisation.name}?`,
        body: "Its people can't sign in and its learning stops until you reactivate it. Its members, courses and records are all kept.",
        confirmLabel: "Suspend organisation",
      }))
    )
      return;
    try {
      const updated =
        organisation.status === "active"
          ? await platformOrganisations.suspend(organisation.slug)
          : await platformOrganisations.reactivate(organisation.slug);

      setItems((prev) =>
        (prev ?? []).map((o) => (o.slug === updated.slug ? { ...o, ...updated } : o)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change that organisation.");
    }
  }

  if (user && !isPlatformOwner) {
    return (
      <Card>
        <Empty
          icon={Building2}
          title="Not available for your account"
          hint="Managing organisations is done by the platform owner. Your console is scoped to your own institution."
        />
      </Card>
    );
  }

  const statusChip = (o: Organisation) => (
    <Chip hue={o.status === "active" ? "mint" : "slate"} dot>
      {o.status === "active" ? "Active" : "Suspended"}
    </Chip>
  );

  const nameLink = (o: Organisation) => (
    <Link
      href={`/suite/platform/organisations/${encodeURIComponent(o.slug)}`}
      className="font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
    >
      {o.name}
    </Link>
  );

  const counts = (o: Organisation) => (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
      <span>{o.studentCount ?? 0} learners</span>
      <span>{o.instructorCount ?? 0} instructors</span>
      <span>{o.courseCount ?? 0} courses</span>
    </span>
  );

  // Suspend from the list. Deleting (to the recycle bin) is on the
  // organisation's own page, so it is never one stray click on a row.
  const toggle = (o: Organisation) => !canManage ? null : (
    <Button
      size="sm"
      icon={o.status === "active" ? Ban : RotateCcw}
      onClick={() => toggleStatus(o)}
      className={
        o.status === "active"
          ? "!text-error-700 hover:!border-error-500/30 hover:!bg-error-500/5"
          : "!text-mint-700 hover:!bg-mint-50"
      }
    >
      {o.status === "active" ? "Suspend" : "Reactivate"}
    </Button>
  );

  const columns: Column<Organisation>[] = [
    {
      key: "name",
      header: "Organisation",
      primary: true,
      sortable: true,
      value: (o) => o.name,
      render: (o) => (
        <span className="flex items-center gap-3">
          <OrgMark name={o.name} logoUrl={o.logoUrl} />
          <span className="min-w-0">
            <span className="block truncate">{nameLink(o)}</span>
            <span className="block truncate text-xs text-neutral-500">
              {o.contactEmail ?? "No contact address"}
            </span>
          </span>
        </span>
      ),
    },
    { key: "members", header: "Members", sortable: true, value: (o) => o.studentCount ?? 0, render: counts },
    {
      key: "seats",
      header: "Seats",
      sortable: true,
      value: (o) => o.seatsUsed,
      render: (o) => <SeatMeter used={o.seatsUsed} limit={o.seatLimit} />,
    },
    { key: "status", header: "Status", sortable: true, value: (o) => o.status, render: statusChip },
    { key: "actions", header: "", align: "right", tableOnly: true, render: toggle },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Organisations"
        subtitle="Every institution on the platform, and the seats they are using."
        actions={
          canManage ? (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New organisation
            </Button>
          ) : undefined
        }
      />

      {error && <ErrorNote className="mb-5">{error}</ErrorNote>}

      <div className="mb-6">
        <StatGrid cols={3}>
          <StatCard featured featuredHue="sun" icon={Building2} label="Organisations" value={totals.organisations.toLocaleString()} />
          <StatCard icon={Users} hue="coral" label="Learners" value={totals.learners.toLocaleString()} />
          <StatCard icon={BookOpen} hue="grape" label="Courses" value={totals.courses.toLocaleString()} />
        </StatGrid>
      </div>

      {items === null ? (
        <div className="space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Loading organisations</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-[1.125rem] bg-neutral-200/60 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(o) => o.id}
          storageKey="platform.organisations"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<StatusFilter>
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { key: "all", label: "All" },
                  { key: "active", label: "Active" },
                  { key: "suspended", label: "Suspended" },
                ]}
              />
              {modules.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <span aria-hidden className="hidden sm:inline">
                    Module
                  </span>
                  <SearchableSelect
                    value={moduleKey}
                    onChange={setModuleKey}
                    aria-label="Module"
                    size="sm"
                    className="w-48"
                    options={[{ value: "", label: "Any module" }, ...modules.map((m) => ({ value: m.key, label: m.label }))]}
                  />
                </div>
              )}
              {moduleKey && (
                <ModuleChip
                  moduleKey={moduleKey}
                  label={`Using ${modules.find((m) => m.key === moduleKey)?.label ?? moduleKey}`}
                />
              )}
            </div>
          }
          caption="All organisations"
          searchPlaceholder="Search by name or contact…"
          matches={(o, q) =>
            o.name.toLowerCase().includes(q) || (o.contactEmail ?? "").toLowerCase().includes(q)
          }
          empty={
            items.length === 0 ? (
              <Empty
                icon={Building2}
                title="No organisations yet"
                hint="Create the first institution and provision its admin in one step."
                action={
                  canManage ? (
                    <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                      New organisation
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Empty
                icon={Building2}
                title="Nothing matches"
                hint="Try a shorter word, or clear the search and filters."
              />
            )
          }
          renderCard={(o) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <OrgMark name={o.name} logoUrl={o.logoUrl} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{nameLink(o)}</p>
                  <p className="truncate text-xs text-neutral-500">{o.contactEmail ?? "No contact address"}</p>
                </div>
                {statusChip(o)}
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-neutral-50 p-3 text-center">
                {[
                  { icon: Users, n: o.studentCount ?? 0, l: "learners" },
                  { icon: GraduationCap, n: o.instructorCount ?? 0, l: "instructors" },
                  { icon: BookOpen, n: o.courseCount ?? 0, l: "courses" },
                ].map(({ icon: I, n, l }) => (
                  <div key={l}>
                    <I size={15} className="mx-auto text-neutral-400" aria-hidden />
                    <p className="mt-1 text-sm font-bold tabular-nums text-neutral-900">{n}</p>
                    <p className="text-[11px] text-neutral-500">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-auto flex items-end justify-between gap-3 border-t border-neutral-100 pt-3">
                <SeatMeter used={o.seatsUsed} limit={o.seatLimit} className="w-32" />
                {toggle(o)}
              </div>
            </div>
          )}
          renderListItem={(o) => (
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <OrgMark name={o.name} logoUrl={o.logoUrl} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    {nameLink(o)} {statusChip(o)}
                  </p>
                  <div className="mt-1">{counts(o)}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <SeatMeter used={o.seatsUsed} limit={o.seatLimit} />
                {toggle(o)}
              </div>
            </div>
          )}
        />
      )}

      {creating && canManage && (
        <NewOrganisationDialog
          onClose={() => setCreating(false)}
          // The dialog stays open on its "what next" step; the list refreshes behind it.
          onCreated={load}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Creating a tenant, optionally with its first admin.
 *
 * The admin fields are offered up front rather than as a second step, because
 * an institution nobody can sign into is not usable — and a two-step flow is a
 * step people forget.
 *
 * Once created, the dialog offers the next step — recording the licence they
 * paid for — which opens the organisation's Modules tab with the licence
 * dialog already up, so licensing a new organisation is one flow.
 */
function NewOrganisationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NewOrganisation>({ name: "" });
  const [withAdmin, setWithAdmin] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Organisation | null>(null);

  const canSubmit =
    form.name.trim().length > 1 &&
    (!withAdmin ||
      ((form.adminName ?? "").trim().length > 1 &&
        (form.adminEmail ?? "").includes("@") &&
        (form.adminPassword ?? "").length >= 8)) &&
    !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    try {
      const organisation = await api.create(
        withAdmin
          ? form
          : { name: form.name, contactEmail: form.contactEmail, seatLimit: form.seatLimit },
      );
      setCreated(organisation);
      onCreated();
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Couldn't create that organisation.");
    }
  }

  if (created) {
    return (
      <DialogFrame
        titleId="new-org-title"
        title={`${created.name} is ready`}
        subtitle="Next, record the modules they paid for. Licensing switches them on and emails their admins."
        onClose={onClose}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Done</Button>
            <ButtonLink
              variant="primary"
              icon={BadgeCheck}
              href={`/suite/platform/organisations/${encodeURIComponent(created.slug)}?tab=modules&licence=record`}
            >
              Record a licence now
            </ButtonLink>
          </div>
        }
      >
        <p role="status" className="flex items-start gap-2 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
          Organisation created. Anything they have not licensed shows to them as a preview.
        </p>
      </DialogFrame>
    );
  }

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId="new-org-title"
      title="New organisation"
      subtitle="An institution, its seat cap and the admin who will run it."
      onClose={onClose}
      footer={
        <>
          {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
          <Button type="submit" variant="primary" disabled={!canSubmit} className="w-full">
            {saving ? "Creating…" : "Create organisation"}
          </Button>
        </>
      }
    >
      <Field
        id="org-name"
        label="Institution name"
        required
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
        placeholder="Acme Institute"
      />

      <Field
        id="org-email"
        label="Contact email"
        type="email"
        value={form.contactEmail ?? ""}
        onChange={(v) => setForm((f) => ({ ...f, contactEmail: v }))}
        placeholder="ops@acme.edu"
      />

      <div>
        <label htmlFor="org-seats" className={labelClass}>
          Seat limit
        </label>
        <input
          id="org-seats"
          type="number"
          min={1}
          value={form.seatLimit ?? ""}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              seatLimit: e.target.value === "" ? null : Number(e.target.value),
            }))
          }
          aria-describedby="org-seats-help"
          className={inputClass}
          placeholder="Unlimited"
        />
        <p id="org-seats-help" className={hintClass}>
          Counts everyone — learners, instructors and admins. Leave blank for no cap.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-neutral-800">
          <input
            type="checkbox"
            checked={withAdmin}
            onChange={(e) => setWithAdmin(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
          />
          <span>
            Create their first admin now
            <span className="mt-0.5 block text-xs font-normal text-neutral-500">
              Without one, nobody at this institution can sign in yet.
            </span>
          </span>
        </label>

        {withAdmin && (
          <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4">
            <Field
              id="admin-name"
              label="Admin name"
              required
              value={form.adminName ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, adminName: v }))}
            />
            <Field
              id="admin-email"
              label="Admin email"
              type="email"
              required
              value={form.adminEmail ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, adminEmail: v }))}
            />
            <Field
              id="admin-password"
              label="Temporary password"
              type="password"
              required
              value={form.adminPassword ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, adminPassword: v }))}
              help="At least 8 characters, with letters and numbers. Share it securely — there is no reset flow."
            />
          </div>
        )}
      </div>
    </DialogFrame>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label} {required && <span className="text-error-600">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={help ? `${id}-help` : undefined}
        autoComplete={type === "password" ? "new-password" : undefined}
        className={inputClass}
      />
      {help && (
        <p id={`${id}-help`} className={hintClass}>
          {help}
        </p>
      )}
    </div>
  );
}
