"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Camera,
  Check,
  KeyRound,
  Loader2,
  Lock,
  MapPin,
  Save,
  ShieldCheck,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import { Button, Chip, PageHeader, Panel, UnderlineTabs } from "@/components/workspace/kit";
import { Avatar } from "@/components/dashboard/ui";
import { FaceAvatar, hintClass, inputClass, labelClass } from "@/suite/lms/components/ui/ws";
import {
  profile as profileApi,
  ApiError,
  type InstructorProfile,
  type InstructorProfileUpdate,
} from "@/lib/api/instructor-client";
import { password as passwordApi, uploadAvatar } from "@/lib/api/account-client";
import NotificationPreferencesPane from "@/components/shared/NotificationPreferencesPane";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/* ------------------------------------------------------------------ */
/*  shared field styles                                                */
/* ------------------------------------------------------------------ */

const INPUT_CLASS = inputClass;


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
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : Check;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${
        tone === "error" ? "bg-error-500/10 text-error-700" : "bg-mint-50 text-mint-700"
      }`}
    >
      <Icon size={15} className="shrink-0" aria-hidden />
      {children}
    </p>
  );
}

function FormFooter({
  dirty,
  saving,
  onCancel,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-4">
      <Button onClick={onCancel} disabled={!dirty || saving}>
        Discard
      </Button>
      <Button variant="primary" onClick={onSave} disabled={!dirty || saving}>
        {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  page                                                              */
/* ------------------------------------------------------------------ */

type TabKey = "profile" | "notifications" | "security";

const TABS: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "notifications", label: "Notifications" },
  { key: "security", label: "Security" },
];

/** Every writable field, so a diff can send only what changed. */
const WRITABLE = [
  "name",
  "title",
  "headline",
  "bio",
  "phone",
  "location",
  "website",
  "twitter",
  "linkedin",
  "avatarUrl",
  "avatarPublicId",
] as const;

type WritableKey = (typeof WRITABLE)[number];
type Draft = Record<WritableKey, string>;

function toDraft(p: InstructorProfile): Draft {
  return Object.fromEntries(WRITABLE.map((k) => [k, p[k] ?? ""])) as Draft;
}

export default function InstructorSettingsPage() {
  const [active, setActive] = useState<TabKey>("profile");

  const [loaded, setLoaded] = useState<InstructorProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;

    profileApi
      .get()
      .then((p) => {
        if (!alive) return;
        setLoaded(p);
        setDraft(toDraft(p));
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Your profile didn't load. Try again.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const changed = useMemo<InstructorProfileUpdate>(() => {
    if (!loaded || !draft) return {};

    const diff: Record<string, string> = {};
    for (const key of WRITABLE) {
      if (draft[key] !== (loaded[key] ?? "")) diff[key] = draft[key];
    }
    return diff as InstructorProfileUpdate;
  }, [loaded, draft]);

  const dirty = Object.keys(changed).length > 0;

  const setField = useCallback(
    (key: WritableKey, value: string) => setDraft((d) => (d ? { ...d, [key]: value } : d)),
    [],
  );

  const save = useCallback(async () => {
    if (!dirty || saving) return;

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await profileApi.update(changed);
      setLoaded(next);
      setDraft(toDraft(next));
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Your profile wasn't saved. Try again.");
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, changed]);

  const discard = useCallback(() => {
    if (loaded) setDraft(toDraft(loaded));
    setSaved(false);
    setError(null);
  }, [loaded]);

  const heading = (
    <PageHeader
      title="Settings"
      subtitle="Your public profile, notifications and password."
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {heading}
        <div className="ws-card flex items-center justify-center gap-2 py-20 text-sm text-neutral-500" role="status">
          <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
          Loading your profile…
        </div>
      </div>
    );
  }

  if (!loaded || !draft) {
    return (
      <div className="space-y-6">
        {heading}
        <Banner tone="error">{error ?? "Your profile isn't available right now."}</Banner>
      </div>
    );
  }

  const footer = <FormFooter dirty={dirty} saving={saving} onCancel={discard} onSave={() => void save()} />;

  return (
    <div className="space-y-6">
      {heading}

      <div>
        <UnderlineTabs tabs={TABS} active={active} onChange={(k) => setActive(k as TabKey)} />
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {saved && !dirty && <Banner tone="success">Your profile is saved.</Banner>}

      {/* ---------------- PROFILE ---------------- */}
      {active === "profile" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Public profile"
          subtitle="What shows on your instructor page."
          icon={UserRound}
          hue="sky"
          bodyClassName="p-0"
        >
          <div className="space-y-6 p-5">
            <AvatarField
              initials={loaded.initials}
              name={draft.name}
              avatarUrl={draft.avatarUrl}
              onChange={(url, publicId) => {
                setField("avatarUrl", url);
                setField("avatarPublicId", publicId);
              }}
              onError={setError}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="name">
                <input
                  id="name"
                  type="text"
                  value={draft.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Title" htmlFor="title">
                <input
                  id="title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => setField("title", e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Headline" htmlFor="headline" className="sm:col-span-2">
                <input
                  id="headline"
                  type="text"
                  value={draft.headline}
                  onChange={(e) => setField("headline", e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>

              <Field
                label="Email"
                htmlFor="email"
                hint="You sign in with this. Ask an admin to change it."
              >
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    value={loaded.email ?? ""}
                    readOnly
                    disabled
                    className={INPUT_CLASS}
                  />
                  <Lock
                    size={14}
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                </div>
              </Field>

              <Field label="Phone" htmlFor="phone">
                <input
                  id="phone"
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Location" htmlFor="location">
                <input
                  id="location"
                  type="text"
                  value={draft.location}
                  onChange={(e) => setField("location", e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Website" htmlFor="website">
                <input
                  id="website"
                  type="url"
                  value={draft.website}
                  onChange={(e) => setField("website", e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Twitter / X" htmlFor="twitter">
                <input
                  id="twitter"
                  type="text"
                  value={draft.twitter}
                  onChange={(e) => setField("twitter", e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="LinkedIn" htmlFor="linkedin">
                <input
                  id="linkedin"
                  type="text"
                  value={draft.linkedin}
                  onChange={(e) => setField("linkedin", e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field
                label="Bio"
                htmlFor="bio"
                className="sm:col-span-2"
                hint="Tell learners about your background and what you know."
              >
                <RichTextEditor id="bio" value={draft.bio} onChange={(html) => setField("bio", html)} />
              </Field>
            </div>
          </div>
          {footer}
        </Panel>

        {/* live preview of the public card */}
        <Panel title="Preview" subtitle="How learners see you" icon={Users} hue="grape" className="lg:self-start" bodyClassName="p-0">
          <div className="h-20 bg-gradient-to-br from-primary-700 via-primary-500 to-grape-400" aria-hidden />
          <div className="-mt-10 flex flex-col items-center px-5 pb-5 text-center">
            <span className="rounded-full bg-white p-1 shadow-md">
              <FaceAvatar name={draft.name || loaded.initials} src={draft.avatarUrl || null} size={72} />
            </span>
            <p className="mt-2 text-[15px] font-semibold text-neutral-900">{draft.name || "Your name"}</p>
            {draft.title && <p className="text-xs font-medium text-primary-700">{draft.title}</p>}
            {draft.headline && <p className="mt-1 text-sm text-neutral-500">{draft.headline}</p>}
            {draft.location && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-500">
                <MapPin size={12} aria-hidden />
                {draft.location}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              <Chip hue="sun" icon={Star}>
                {Number(loaded.rating ?? 0).toFixed(1)} rating
              </Chip>
              <Chip hue="sky" icon={Users}>
                {loaded.studentCount} learners
              </Chip>
              <Chip hue="grape" icon={BookOpen}>
                {loaded.courseCount} courses
              </Chip>
            </div>
          </div>
        </Panel>
        </div>
      )}

      {/* ---------------- PAYOUT ---------------- */}
      {/* ---------------- NOTIFICATIONS ---------------- */}
      {active === "notifications" && <NotificationsPane />}

      {/* ---------------- SECURITY ---------------- */}
      {active === "security" && <SecurityPane />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Avatar                                                             */
/* ------------------------------------------------------------------ */

function AvatarField({
  initials,
  name,
  avatarUrl,
  onChange,
  onError,
}: {
  initials: string;
  name: string;
  avatarUrl: string;
  onChange: (url: string, publicId: string) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    try {
      // The shared profile-photo endpoint: 2 MB cap, `avatars/` folder, open to
      // every role. The course-media route would allow a 10 MB course image.
      const asset = await uploadAvatar(file);
      onChange(asset.url, asset.publicId);
    } catch (e) {
      onError(e instanceof Error ? e.message : "That image didn't upload. Try another.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <Avatar
        initials={initials || name.slice(0, 2).toUpperCase()}
        size={72}
        src={avatarUrl || null}
        alt={name}
      />
      <div className="text-center sm:text-left">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />}
          {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
        </Button>
        <p className="mt-2 text-xs text-neutral-500">
          {avatarUrl ? "Save your changes to use the new photo." : "JPG, PNG, WebP or AVIF, up to 2 MB."}
        </p>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

/**
 * The switches themselves live in a shared pane: the registry behind them
 * follows what each person does (roles, employment, projects), so the same
 * list has to be reachable from the HR console too. Only the closing note is
 * instructor-specific.
 */
function NotificationsPane() {
  return (
    <NotificationPreferencesPane
      footer={
        <p className="text-xs text-neutral-500">
          Purchase receipts, payment failures and refund confirmations go to the
          learner, not to you. Course questions arrive in your{" "}
          <a
            href="/suite/lms/teach/messages"
            className="font-medium text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Q&amp;A inbox
          </a>
          .
        </p>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Security: password only. There is no 2FA and no reset flow.        */
/* ------------------------------------------------------------------ */

function SecurityPane() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ready = current !== "" && next.length >= 8 && next === confirm;

  async function submit() {
    if (!ready || busy) return;

    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await passwordApi.update({
        currentPassword: current,
        password: next,
        password_confirmation: confirm,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Your password wasn't changed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Banner tone="error">{error}</Banner>}
      {done && (
        <Banner tone="success">
          Password changed. Every other device you were signed in on is now signed out.
        </Banner>
      )}

      <Panel
        title="Password"
        subtitle="Use a password of at least 8 characters that you don't use anywhere else."
        icon={ShieldCheck}
        hue="mint"
        bodyClassName="p-0"
      >
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <Field label="Current password" htmlFor="currentPassword">
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="New password" htmlFor="newPassword">
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field
            label="Confirm new password"
            htmlFor="confirmPassword"
            hint={
              confirm !== "" && confirm !== next ? "The two passwords don't match." : undefined
            }
          >
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-3 border-t border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            Forgotten it? Choose “Forgot password?” on the sign-in page and we email you a reset link.
          </p>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!ready || busy}
            className="self-start sm:self-auto"
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <KeyRound size={16} aria-hidden />}
            {busy ? "Changing…" : "Change password"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
