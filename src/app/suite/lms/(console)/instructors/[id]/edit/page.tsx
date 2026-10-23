"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Users, Save, AlertTriangle, Trash2, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { Button, ButtonLink, Card, Empty, PageHeader, Panel } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  BackLink,
  ErrorNote,
  FaceAvatar,
  Field as WsField,
  FormActions,
  StatusChip,
  inputClass,
} from "@/suite/lms/components/ui/ws";
import {
  analytics,
  instructors as instructorsApi,
  ApiError,
  type AdminInstructorDetail,
} from "@/lib/api/admin-client";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/* ------------------------------------------------------------------ */
/*  shared field styles                                                */
/* ------------------------------------------------------------------ */

const INPUT_CLASS = inputClass;

/** UI label → backend enum value (InstructorStatus). */
const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Suspended", value: "suspended" },
];

/* ---------- field wrapper ---------------------------------------- */

function Field({
  label,
  htmlFor,
  hint,
  className = "",
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <WsField id={htmlFor} label={label} className={className}>
      {children}
      {hint && <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>}
    </WsField>
  );
}

/* ------------------------------------------------------------------ */
/*  page                                                              */
/* ------------------------------------------------------------------ */

interface FormState {
  name: string;
  title: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  /** Backend enum value: "active" | "pending" | "suspended". */
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  Active: "active",
  Pending: "pending",
  Suspended: "suspended",
};

export default function AdminInstructorEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();

  const [detail, setDetail] = useState<AdminInstructorDetail | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    title: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    bio: "",
    status: "active",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    analytics
      .instructor(id)
      .then((d: AdminInstructorDetail) => {
        if (alive) {
          setDetail(d);
          setForm({
            name: d.name ?? "",
            title: d.title ?? "",
            headline: d.headline ?? "",
            email: d.email ?? "",
            phone: d.phone ?? "",
            location: d.location ?? "",
            bio: d.bio ?? "",
            status: STATUS_LABEL[d.status] ?? "active",
          });
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Failed to load.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await instructorsApi.update(id, {
        name: form.name,
        email: form.email,
        title: form.title,
        headline: form.headline,
        bio: form.bio,
        phone: form.phone,
        location: form.location,
        status: form.status,
      });
      router.push(`/suite/lms/instructors/${id}`);
    } catch (e: unknown) {
      setSaveError(
        e instanceof ApiError ? e.message : "Could not save changes.",
      );
      setSaving(false);
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: form.name ? `Remove ${form.name} as an instructor?` : "Remove this instructor?",
      body: "Their instructor profile moves to the organisation's recycle bin, where an admin can restore it. Their courses stay in the catalogue.",
      confirmLabel: "Remove instructor",
      recoverable: true,
    });
    if (!ok) return;
    setDeleting(true);
    setSaveError(null);
    try {
      await instructorsApi.remove(id);
      router.push("/suite/lms/instructors");
    } catch (e: unknown) {
      setSaveError(
        e instanceof ApiError ? e.message : "Could not remove the instructor.",
      );
      setDeleting(false);
    }
  }

  /* ---------- loading ------------------------------------------- */
  if (loading) {
    return (
      <div>
        <BackLink href="/suite/lms/instructors" label="Back to instructors" />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-neutral-500">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          Loading instructor…
        </div>
      </div>
    );
  }

  /* ---------- error / not found --------------------------------- */
  if (error || !detail) {
    return (
      <div>
        <BackLink href="/suite/lms/instructors" label="Back to instructors" />
        <Card>
          <Empty
            icon={Users}
            hue="grape"
            title={error ?? "Instructor not found"}
            hint="This instructor account does not exist or may have been removed."
            action={<ButtonLink href="/suite/lms/instructors">Browse all instructors</ButtonLink>}
          />
        </Card>
      </div>
    );
  }

  const currentLabel = STATUS_OPTIONS.find((s) => s.value === form.status)?.label ?? form.status;

  const saveButton = (
    <Button variant="primary" onClick={handleSave} disabled={saving}>
      {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
      Save changes
    </Button>
  );

  return (
    <div className="space-y-6">
      <div>
        <BackLink href={`/suite/lms/instructors/${id}`} label="Back to instructor" />
        <PageHeader
          eyebrow="Edit instructor"
          title={
            <span className="flex flex-wrap items-center gap-3">
              <FaceAvatar name={detail.name} size={44} />
              {detail.name}
              <StatusChip status={currentLabel} />
            </span>
          }
          subtitle={detail.email ?? "—"}
          actions={
            <>
              <ButtonLink href={`/suite/lms/instructors/${id}`}>Cancel</ButtonLink>
              {saveButton}
            </>
          }
        />
      </div>

      {saveError && <ErrorNote>{saveError}</ErrorNote>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ---------- profile ---------- */}
        <Panel
          title="Profile"
          subtitle="Public-facing instructor details."
          icon={UserRound}
          hue="grape"
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="name">
              <input id="name" type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Title" htmlFor="title">
              <input id="title" type="text" value={form.title} onChange={(e) => setField("title", e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Email" htmlFor="email">
              <input id="email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <input id="phone" type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Location" htmlFor="location">
              <input
                id="location"
                type="text"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Headline" htmlFor="headline" hint="Short tagline shown under the instructor's name.">
              <input
                id="headline"
                type="text"
                value={form.headline}
                onChange={(e) => setField("headline", e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Bio" htmlFor="bio" className="sm:col-span-2" hint="Shown on the instructor's public profile page.">
              <RichTextEditor id="bio" value={form.bio} onChange={(html) => setField("bio", html)} />
            </Field>
          </div>
        </Panel>

        <div className="min-w-0 space-y-6">
          {/* ---------- account status ---------- */}
          <Panel
            title="Account status"
            subtitle="Controls whether this instructor can sign in and publish."
            icon={ShieldCheck}
            hue="mint"
          >
            <Field label="Status" htmlFor="status" hint="Suspended accounts lose dashboard access immediately.">
              <SearchableSelect
                id="status"
                value={form.status}
                onChange={(v) => setField("status", v)}
                options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
              />
            </Field>
            <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
              <span>Current</span>
              <StatusChip status={currentLabel} />
            </div>
          </Panel>

          {/* ---------- danger zone ---------- */}
          <section aria-labelledby="danger-zone" className="overflow-hidden rounded-[1.125rem] border border-error-500/25 bg-white">
            <div className="flex items-center gap-3 bg-error-500/5 px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-error-500/10 text-error-700">
                <AlertTriangle size={18} aria-hidden />
              </span>
              <h3 id="danger-zone" className="text-[15px] font-semibold text-error-700">
                Danger zone
              </h3>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">Remove instructor</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Permanently delete this instructor and all associated data. This action cannot be undone.
                </p>
              </div>
              <Button variant="danger" onClick={handleRemove} disabled={deleting} className="self-start">
                {deleting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Trash2 size={16} aria-hidden />}
                Remove instructor
              </Button>
            </div>
          </section>
        </div>
      </div>

      {/* ---------- footer ---------- */}
      <FormActions>
        <ButtonLink href={`/suite/lms/instructors/${id}`}>Cancel</ButtonLink>
        {saveButton}
      </FormActions>
    </div>
  );
}
