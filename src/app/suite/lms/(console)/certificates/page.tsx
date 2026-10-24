"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  CalendarX,
  Plus,
  Pencil,
  Trash2,
  Star,
  X,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Search,
  FileBadge,
  PenLine,
} from "lucide-react";
import {
  certificateTemplates as templatesApi,
  issuedCertificates as certsApi,
  ApiError,
  type AdminCertificateTemplate,
  type AdminCertificate,
} from "@/lib/api/admin-client";
import { Button, Card, Chip, Empty, PageHeader, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ErrorNote, FaceAvatar, StatCard, inputClass } from "@/suite/lms/components/ui/ws";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

const INPUT = inputClass;

type Tab = "templates" | "issued";

const BLANK: Partial<AdminCertificateTemplate> = {
  name: "",
  description: "",
  orgName: "XwiftHQ",
  signatoryName: "",
  signatoryTitle: "Director of Learning",
  accentColor: "#9638cd",
  logoUrl: "",
  isDefault: false,
  isActive: true,
};

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "-";

/*
  Three states. "Valid" used to mean "not revoked", which was the whole story
  while nothing expired. A lapsed certificate is not revoked either, and
  calling it valid is the answer a renewals chase most needs to not be given.
*/
function CertState({ c }: { c: AdminCertificate }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {c.revoked ? (
        <Chip hue="rose" icon={ShieldAlert}>
          Revoked
        </Chip>
      ) : c.expired ? (
        <Chip hue="sun" icon={CalendarX}>
          Expired
        </Chip>
      ) : (
        <Chip hue="mint" icon={ShieldCheck}>
          Valid
        </Chip>
      )}
      {!c.revoked && !c.expired && c.expiresAt && (
        <span className="text-[11px] text-neutral-500">until {fmtDate(c.expiresAt)}</span>
      )}
    </span>
  );
}

export default function AdminCertificatesPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("templates");

  const [templates, setTemplates] = useState<AdminCertificateTemplate[]>([]);
  const [certs, setCerts] = useState<AdminCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<Partial<AdminCertificateTemplate> | null>(null);

  const loadTemplates = useCallback(async () => {
    const list = await templatesApi.list();
    setTemplates(list);
  }, []);

  const loadCerts = useCallback(async (q = "") => {
    const list = await certsApi.list(q ? `?search=${encodeURIComponent(q)}` : "");
    setCerts(list);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([templatesApi.list(), certsApi.list()])
      .then(([t, c]) => {
        if (!alive) return;
        setTemplates(t);
        setCerts(c);
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Failed to load."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const onRevoke = async (serial: string, revoked: boolean) => {
    if (
      !revoked &&
      !(await confirm({
        title: `Revoke certificate ${serial}?`,
        body: "It stops verifying as valid straight away. You can reinstate it later from this list.",
        confirmLabel: "Revoke certificate",
      }))
    )
      return;
    try {
      const updated = revoked ? await certsApi.reinstate(serial) : await certsApi.revoke(serial);
      setCerts((cs) => cs.map((c) => (c.serial === serial ? updated : c)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed.");
    }
  };

  const onDeleteTemplate = async (t: AdminCertificateTemplate) => {
    const ok = await confirm({
      title: `Delete the “${t.name}” template?`,
      body: "Courses using it fall back to the default template. It moves to the organisation's recycle bin, where an admin can restore it.",
      confirmLabel: "Delete template",
      recoverable: true,
    });
    if (!ok) return;
    try {
      await templatesApi.remove(t.id);
      await loadTemplates();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete the template.");
    }
  };

  const counts = useMemo(
    () => ({
      valid: certs.filter((c) => !c.revoked && !c.expired).length,
      expired: certs.filter((c) => !c.revoked && c.expired).length,
      revoked: certs.filter((c) => c.revoked).length,
    }),
    [certs],
  );

  const templateActions = (t: AdminCertificateTemplate) => (
    <div className="flex items-center gap-2">
      <Button size="sm" icon={Pencil} onClick={() => setEditing(t)}>
        Edit
      </Button>
      <Button
        size="sm"
        icon={Trash2}
        onClick={() => onDeleteTemplate(t)}
        className="!text-error-700 hover:!border-error-500/30 hover:!bg-error-500/5"
      >
        Delete
      </Button>
    </div>
  );

  const templateMark = (t: AdminCertificateTemplate, size = 40) => (
    <span
      className="flex shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
      style={{ width: size, height: size, backgroundColor: t.accentColor }}
      aria-hidden
    >
      <Award size={Math.round(size * 0.45)} />
    </span>
  );

  const templateColumns: Column<AdminCertificateTemplate>[] = [
    {
      key: "name",
      header: "Template",
      primary: true,
      sortable: true,
      value: (t) => t.name,
      render: (t) => (
        <span className="flex items-center gap-3">
          {templateMark(t, 36)}
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-semibold text-neutral-900">{t.name}</span>
              {t.isDefault && (
                <Chip hue="blue" icon={Star}>
                  Default
                </Chip>
              )}
            </span>
            <span className="block truncate text-xs text-neutral-500">{t.orgName}</span>
          </span>
        </span>
      ),
    },
    { key: "signatory", header: "Signatory", sortable: true, value: (t) => t.signatoryName || "" },
    { key: "issued", header: "Issued", align: "right", sortable: true, value: (t) => t.certificatesIssued ?? 0 },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (t) => (t.isActive ? "Active" : "Inactive"),
      render: (t) => <Chip hue={t.isActive ? "mint" : "slate"} dot>{t.isActive ? "Active" : "Inactive"}</Chip>,
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: templateActions },
  ];

  const revokeButton = (c: AdminCertificate) => (
    <Button
      size="sm"
      onClick={() => onRevoke(c.serial, c.revoked)}
      className={c.revoked ? "" : "!text-error-700 hover:!border-error-500/30 hover:!bg-error-500/5"}
    >
      {c.revoked ? "Reinstate" : "Revoke"}
    </Button>
  );

  /*
    The serial opens the console record rather than the public page. An
    administrator looking at this list is deciding something about the
    certificate, and the verification page is written for a stranger: it does
    not say who holds it or what they did to earn it.
  */
  const serialCell = (c: AdminCertificate) => (
    <span className="inline-flex items-center">
      <Link
        href={`/suite/lms/certificates/${c.serial}`}
        className="font-semibold tracking-wide text-primary-700 hover:underline"
      >
        {c.serial}
      </Link>
      <Link
        href={`/verify/${c.serial}`}
        target="_blank"
        aria-label={`See what a verifier sees for ${c.serial}`}
        className="ml-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      >
        <ExternalLink size={13} aria-hidden />
      </Link>
    </span>
  );

  const certColumns: Column<AdminCertificate>[] = [
    { key: "serial", header: "Serial", sortable: true, value: (c) => c.serial, render: serialCell },
    {
      key: "recipient",
      header: "Recipient",
      primary: true,
      sortable: true,
      value: (c) => c.recipientName,
      render: (c) => (
        <span className="flex items-center gap-2.5">
          <FaceAvatar name={c.recipientName} size={30} />
          <span className="font-medium text-neutral-900">{c.recipientName}</span>
        </span>
      ),
    },
    {
      key: "course",
      header: "Course",
      sortable: true,
      value: (c) => c.courseTitle,
      render: (c) => <span className="block max-w-[220px] truncate text-neutral-600">{c.courseTitle}</span>,
    },
    {
      key: "issued",
      header: "Issued",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.issuedAt ?? "",
      render: (c) => <span className="text-neutral-500">{fmtDate(c.issuedAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (c) => (c.revoked ? "Revoked" : c.expired ? "Expired" : "Valid"),
      render: (c) => <CertState c={c} />,
    },
    { key: "actions", header: "Actions", align: "right", tableOnly: true, render: revokeButton },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        subtitle="Design the certificate your learners receive, and manage every certificate you have issued."
        actions={
          tab === "templates" ? (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({ ...BLANK })}>
              New template
            </Button>
          ) : undefined
        }
        tabs={[
          { key: "templates", label: "Templates", count: templates.length },
          { key: "issued", label: "Issued", count: certs.length },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {!loading && (
        <StatGrid>
          <StatCard featured featuredHue="grape" label="Certificates issued" value={certs.length} icon={Award} />
          <StatCard label="Valid" value={counts.valid} icon={ShieldCheck} hue="mint" hint="Verify as valid today" />
          <StatCard label="Expired" value={counts.expired} icon={CalendarX} hue="sun" hint="Due for renewal" />
          <StatCard label="Revoked" value={counts.revoked} icon={ShieldAlert} hue="rose" hint="Withdrawn by your team" />
        </StatGrid>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 size={16} className="animate-spin" aria-hidden /> Loading certificates…
        </div>
      ) : tab === "templates" ? (
        templates.length === 0 ? (
          <Card>
            <Empty
              icon={Award}
              hue="grape"
              title="No templates yet"
              hint="Create a template to start issuing certificates."
            />
          </Card>
        ) : (
          <DataView
            rows={templates}
            columns={templateColumns}
            rowKey={(t) => t.id}
            storageKey="lms.certificate-templates"
            defaultView="grid"
            caption="Certificate templates"
            searchPlaceholder="Search templates"
            renderCard={(t) => (
              <div className="flex h-full flex-col">
                {/* A miniature of the certificate itself, in its accent colour. */}
                <div className="p-2 pb-0">
                  <div
                    className="relative flex h-28 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 bg-white text-center"
                    style={{ borderColor: t.accentColor }}
                  >
                    <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: t.accentColor }} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Certificate of completion
                    </span>
                    <span className="mt-1.5 text-sm font-bold text-neutral-900">{t.orgName}</span>
                    <span className="mt-1 text-[11px] text-neutral-500">{t.signatoryName || "Signatory"}</span>
                    {t.isDefault && (
                      <span className="absolute right-2 top-3">
                        <Chip hue="blue" icon={Star}>
                          Default
                        </Chip>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    {templateMark(t, 36)}
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-neutral-900">{t.name}</p>
                      <p className="truncate text-xs text-neutral-500">{t.orgName}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip hue="slate" icon={PenLine}>
                      {t.signatoryName || "-"}
                    </Chip>
                    <Chip hue="grape" icon={FileBadge}>
                      {t.certificatesIssued ?? 0} issued
                    </Chip>
                    <Chip hue={t.isActive ? "mint" : "slate"} dot>
                      {t.isActive ? "Active" : "Inactive"}
                    </Chip>
                  </div>
                  <div className="mt-auto border-t border-neutral-100 pt-3">{templateActions(t)}</div>
                </div>
              </div>
            )}
            renderListItem={(t) => (
              <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                {templateMark(t)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{t.name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {t.orgName} · {t.signatoryName || "-"} · {t.certificatesIssued ?? 0} issued
                  </p>
                </div>
                <Chip hue={t.isActive ? "mint" : "slate"} dot>
                  {t.isActive ? "Active" : "Inactive"}
                </Chip>
                {templateActions(t)}
              </div>
            )}
          />
        )
      ) : (
        <DataView
          rows={certs}
          columns={certColumns}
          rowKey={(c) => c.serial}
          storageKey="lms.certificates-issued"
          caption="Issued certificates"
          searchable={false}
          toolbar={
            <form
              role="search"
              className="flex w-full items-center gap-2 sm:w-auto"
              onSubmit={(e) => {
                e.preventDefault();
                void loadCerts(search);
              }}
            >
              <label className="relative block min-w-0 flex-1">
                <span className="sr-only">Search certificates</span>
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by serial, recipient or course"
                  className={`${INPUT} w-full pl-10 sm:w-72`}
                />
              </label>
              <Button type="submit">
                Search
              </Button>
            </form>
          }
          renderCard={(c) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <FaceAvatar name={c.recipientName} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{c.recipientName}</p>
                    <p className="truncate text-xs text-neutral-500">{fmtDate(c.issuedAt)}</p>
                  </div>
                </div>
                <CertState c={c} />
              </div>
              <p className="line-clamp-2 text-sm text-neutral-700">{c.courseTitle}</p>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                {serialCell(c)}
                {revokeButton(c)}
              </div>
            </div>
          )}
          renderListItem={(c) => (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <FaceAvatar name={c.recipientName} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{c.recipientName}</p>
                <p className="truncate text-xs text-neutral-500">
                  {c.courseTitle} · {fmtDate(c.issuedAt)}
                </p>
              </div>
              {serialCell(c)}
              <CertState c={c} />
              {revokeButton(c)}
            </div>
          )}
          empty={
            <Empty
              icon={Award}
              hue="grape"
              title="No certificates issued yet"
              hint="Certificates show here as learners finish courses that award one."
            />
          }
        />
      )}

      {editing && (
        <TemplateEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadTemplates();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor modal                                                       */
/* ------------------------------------------------------------------ */

function TemplateEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<AdminCertificateTemplate>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial.id);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof AdminCertificateTemplate>(k: K, v: AdminCertificateTemplate[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setErr(null);
    if (!form.name?.trim() || !form.orgName?.trim() || !form.signatoryName?.trim()) {
      setErr("Name, organisation and signatory are required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        orgName: form.orgName,
        signatoryName: form.signatoryName,
        signatoryTitle: form.signatoryTitle || "Director of Learning",
        accentColor: form.accentColor || "#9638cd",
        logoUrl: form.logoUrl || null,
        isDefault: !!form.isDefault,
        isActive: form.isActive ?? true,
      };
      if (isEdit && initial.id) await templatesApi.update(initial.id, body);
      else await templatesApi.create(body);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save the template.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain p-4">
      <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="template-editor-title" className="relative z-10 my-auto w-full max-w-lg overflow-hidden rounded-[1.25rem] bg-white shadow-2xl shadow-primary-900/20">
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2 id="template-editor-title" className="text-lg font-bold tracking-tight text-neutral-900">
            {isEdit ? "Edit template" : "New certificate template"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Template name">
            <input className={INPUT} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. XwiftHQ Classic" />
          </Field>
          <Field label="Organisation name">
            <input className={INPUT} value={form.orgName ?? ""} onChange={(e) => set("orgName", e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Signatory name">
              <input className={INPUT} value={form.signatoryName ?? ""} onChange={(e) => set("signatoryName", e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Signatory title">
              <input className={INPUT} value={form.signatoryTitle ?? ""} onChange={(e) => set("signatoryTitle", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Accent colour">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor ?? "#9638cd"}
                  onChange={(e) => set("accentColor", e.target.value)}
                  aria-label="Pick accent colour" className="h-11 w-12 shrink-0 cursor-pointer rounded-xl border border-neutral-200"
                />
                <input className={INPUT} value={form.accentColor ?? ""} onChange={(e) => set("accentColor", e.target.value)} />
              </div>
            </Field>
            <Field label="Logo URL (optional)">
              <input className={INPUT} value={form.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…" />
            </Field>
          </div>
          <Field label="Description (optional)">
            <input className={INPUT} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={!!form.isDefault} onChange={(e) => set("isDefault", e.target.checked)} className="accent-primary-600" />
              Set as default
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} className="accent-primary-600" />
              Active
            </label>
          </div>

          {err && <p role="alert" className="text-sm text-error-700">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {isEdit ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/*
  A label wrapping its control, so every input here has an accessible name
  without threading an id through each one.
*/
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
