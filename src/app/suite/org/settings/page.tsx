"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  BookOpen,
  Building2,
  Check,
  Coins,
  KeyRound,
  Loader2,
  Mail,
  MessageCircle,
  Plug,
  Plus,
  Save,
  ShieldCheck,
  Timer,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { FaceAvatar, inputClass } from "@/suite/lms/components/ui/ws";
import { formatDate } from "@/lib/console-data";
import {
  settings as settingsApi,
  team as teamApi,
  ApiError,
  type Integration,
  type PlatformSettingsMap,
  type SettingKey,
  type SettingSpec,
  type SettingsPayload,
  type TeamMember,
  SECRET_MASK,
} from "@/lib/api/admin-client";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { useAuth } from "@/lib/auth-store";

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

const INPUT_CLASS = inputClass;

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary-600" : "bg-neutral-200",
      )}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/**
 * The `effect` line comes from the backend's own schema, so every switch here
 * states what it changes rather than implying something it does not do.
 */
function ToggleSetting({
  spec,
  checked,
  onChange,
  disabled,
}: {
  spec: SettingSpec;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-1 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{spec.label}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{spec.effect}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={spec.label} disabled={disabled} />
    </div>
  );
}

function TextSetting({
  spec,
  value,
  onChange,
}: {
  spec: SettingSpec;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">{spec.label}</span>
      <input
        type="text"
        className={INPUT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="mt-1.5 block text-xs text-neutral-500">{spec.effect}</span>
    </label>
  );
}

/**
 * A credential the server will never hand back.
 *
 * The field starts empty even when one is stored, and an empty submission means
 * "keep what you have" — so an admin editing the template name beside it cannot
 * blank the token by saving the form. `stored` is the only thing the API tells
 * us about it, and saying "a token is saved" is the whole reason it is here:
 * an empty box with no explanation reads as "not configured".
 */
function SecretSetting({
  spec,
  stored,
  value,
  onChange,
}: {
  spec: SettingSpec;
  stored: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-neutral-700">
        {spec.label}
        {stored && (
          <Chip hue="mint" icon={BadgeCheck}>
            Saved
          </Chip>
        )}
      </span>
      <input
        type="password"
        autoComplete="off"
        className={INPUT_CLASS}
        // The draft is seeded from the API, which sends a mask. Showing that
        // mask in the box would invite an admin to edit it into nonsense and
        // save it as the new credential.
        value={value === SECRET_MASK ? "" : value}
        placeholder={stored ? "Leave blank to keep the saved token" : "Paste the access token"}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="mt-1.5 block text-xs text-neutral-500">{spec.effect}</span>
    </label>
  );
}

function Banner({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : Check;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
        tone === "error" ? "border-error-500/20 bg-error-500/5 text-error-700" : "border-mint-100 bg-mint-50 text-mint-700",
      )}
    >
      <Icon size={15} className="shrink-0" aria-hidden />
      {children}
    </p>
  );
}

function SaveFooter({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="ws-card flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-neutral-500">{dirty ? "You have unsaved changes." : "Everything is saved."}</p>
      <div className="flex items-center justify-end gap-2">
        <Button onClick={onDiscard} disabled={!dirty || saving}>
          Discard
        </Button>
        <Button variant="primary" onClick={onSave} disabled={!dirty || saving}>
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

type TabKey = "general" | "payments" | "whatsapp" | "notifications" | "team";

const TABS: { key: TabKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "payments", label: "Payments & Fees" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "notifications", label: "Notifications" },
  { key: "team", label: "Admins" },
];

/**
 * The notification switches, read from the server's schema rather than a
 * list kept here. A hard-coded list named `notify_purchase_receipt`, which
 * the server no longer has, so `schema[key]` was undefined and the tab
 * crashed; it also never showed the assignment, HR or Projects switches.
 * Grouped by the module a switch belongs to, in the schema's own order.
 */
const NOTIFICATION_SECTIONS: { key: string; title: string; test: (key: string) => boolean }[] = [
  { key: "hrm", title: "People (HR)", test: (k) => k.startsWith("notify_hrm_") },
  { key: "projects", title: "Projects", test: (k) => k.startsWith("notify_projects_") },
  { key: "learning", title: "Learning and licences", test: () => true },
];

function notificationSections(schema: Partial<Record<string, SettingSpec>>) {
  const keys = Object.entries(schema)
    .filter(([, spec]) => spec?.group === "notifications" && spec.type === "bool")
    .map(([key]) => key as SettingKey);

  const taken = new Set<string>();
  return NOTIFICATION_SECTIONS.map((section) => {
    const own = keys.filter((k) => !taken.has(k) && section.test(k));
    own.forEach((k) => taken.add(k));
    return { key: section.key, title: section.title, keys: own };
  })
    .filter((s) => s.keys.length > 0)
    // Learning first: it is the oldest and the one most organisations use.
    .sort((a, b) => (a.key === "learning" ? -1 : b.key === "learning" ? 1 : 0));
}

/**
 * Settings: the platform's own, and the organisation's admins.
 *
 * Everything but the Admins tab is the platform owner's - saving it needs
 * `role:super_admin` - so an organisation admin is not shown it at all (O3,
 * 2 Oct 2026). They used to reach it as "Organisation settings" and get a 403
 * on save. What is theirs here is who runs the organisation's console.
 */
export default function AdminSettingsPage() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user?.role !== "super_admin") return <OrganisationAdminsPage />;

  return <PlatformSettingsPage />;
}

function OrganisationAdminsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Institution"
        title="Organisation admins"
        subtitle="Who runs this organisation's console. Platform-wide settings are kept by the platform owner."
      />
      <TeamPane />
    </div>
  );
}

function PlatformSettingsPage() {
  const [active, setActive] = useState<TabKey>("general");

  const [payload, setPayload] = useState<SettingsPayload | null>(null);
  const [draft, setDraft] = useState<PlatformSettingsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;

    settingsApi
      .get()
      .then((data) => {
        if (!alive) return;
        setPayload(data);
        setDraft(data.settings);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Could not load settings.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  /** Only the keys an admin actually touched are sent. */
  const changed = useMemo<Partial<PlatformSettingsMap>>(() => {
    if (!payload || !draft) return {};

    const diff: Record<string, unknown> = {};
    for (const key of Object.keys(draft) as SettingKey[]) {
      if (draft[key] !== payload.settings[key]) diff[key] = draft[key];
    }
    return diff as Partial<PlatformSettingsMap>;
  }, [payload, draft]);

  const dirty = Object.keys(changed).length > 0;

  const setField = useCallback(
    <K extends SettingKey>(key: K, value: PlatformSettingsMap[K]) =>
      setDraft((d) => (d ? { ...d, [key]: value } : d)),
    [],
  );

  const save = useCallback(async () => {
    if (!dirty || saving) return;

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await settingsApi.update(changed);
      setPayload(next);
      setDraft(next.settings);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your settings.");
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, changed]);

  const discard = useCallback(() => {
    if (payload) setDraft(payload.settings);
    setSaved(false);
    setError(null);
  }, [payload]);

  const heading = (
    <PageHeader
      eyebrow="Institution"
      title="Platform Settings"
      subtitle="Configure how XwiftHQ runs across the whole platform."
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {heading}
        <div className="flex items-center gap-2 py-20 text-sm text-neutral-500">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading settings…
        </div>
      </div>
    );
  }

  if (!payload || !draft) {
    return (
      <div className="space-y-6">
        {heading}
        <Banner tone="error">{error ?? "Settings are unavailable."}</Banner>
      </div>
    );
  }

  const { schema, integrations } = payload;
  const footer = (
    <SaveFooter dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Institution"
        title="Platform Settings"
        subtitle="Configure how XwiftHQ runs across the whole platform."
        tabs={TABS}
        activeTab={active}
        onTab={(k) => setActive(k as TabKey)}
      />

      {error && <Banner tone="error">{error}</Banner>}
      {saved && !dirty && <Banner tone="success">Settings saved.</Banner>}

      {/* ---------------------------------------------------------- */}
      {/* GENERAL                                                    */}
      {/* ---------------------------------------------------------- */}
      {active === "general" && (
        <div className="space-y-5">
          <Panel title="Brand" subtitle="How the platform identifies itself" icon={ShieldCheck}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-neutral-700">
                  {schema.platform_name.label}
                </span>
                <input
                  type="text"
                  maxLength={64}
                  className={INPUT_CLASS}
                  value={draft.platform_name}
                  onChange={(e) => setField("platform_name", e.target.value)}
                />
                <span className="mt-1.5 block text-xs text-neutral-500">
                  {schema.platform_name.effect}
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-neutral-700">
                  {schema.support_email.label}
                </span>
                <input
                  type="email"
                  placeholder="support@yourdomain.com"
                  className={INPUT_CLASS}
                  value={draft.support_email}
                  onChange={(e) => setField("support_email", e.target.value)}
                />
                <span className="mt-1.5 block text-xs text-neutral-500">
                  {schema.support_email.effect}
                </span>
              </label>
            </div>
          </Panel>

          <Panel title="Catalog" subtitle="Publishing and moderation defaults" icon={BookOpen} hue="grape">
            <div className="divide-y divide-neutral-100">
              <ToggleSetting
                spec={schema.require_course_approval}
                checked={draft.require_course_approval}
                onChange={(v) => setField("require_course_approval", v)}
                disabled={saving}
              />
              <ToggleSetting
                spec={schema.require_review_approval}
                checked={draft.require_review_approval}
                onChange={(v) => setField("require_review_approval", v)}
                disabled={saving}
              />
            </div>
            <p className="mt-3 flex items-start gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
              <Building2 size={13} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
              These two are defaults. An institution can answer either for itself from its own
              Policies page, and one that has answered keeps its answer when you change yours.
            </p>
          </Panel>

          {footer}
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {/* PAYMENTS & FEES                                            */}
      {/* ---------------------------------------------------------- */}
      {active === "payments" && (
        <div className="space-y-5">
          <Panel title="Revenue share" subtitle="How earnings are split with instructors" icon={Coins} hue="sun">
            <label className="block max-w-xs">
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">
                {schema.platform_fee_percent.label}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                className={INPUT_CLASS}
                value={draft.platform_fee_percent}
                onChange={(e) =>
                  setField(
                    "platform_fee_percent",
                    Math.max(0, Math.min(100, Math.round(Number(e.target.value)) || 0)),
                  )
                }
              />
              <span className="mt-1.5 block text-xs text-neutral-500">
                {schema.platform_fee_percent.effect}
              </span>
            </label>

            <div className="mt-5">
              <SplitBar feePercent={draft.platform_fee_percent} />
            </div>
          </Panel>

          <Panel title="Licences" subtitle="The default every institution follows" icon={Timer} hue="coral">
            <label className="block max-w-xs">
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">
                {schema.seat_grace_days.label}
              </span>
              <input
                type="number"
                min={0}
                max={180}
                className={INPUT_CLASS}
                value={draft.seat_grace_days}
                onChange={(e) =>
                  setField(
                    "seat_grace_days",
                    Math.max(0, Math.min(180, Math.round(Number(e.target.value)) || 0)),
                  )
                }
              />
              <span className="mt-1.5 block text-xs text-neutral-500">
                {schema.seat_grace_days.effect}
              </span>
            </label>

            <p className="mt-3 flex items-start gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
              <Building2 size={13} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
              A default. Give one institution a longer window on its own page. An institution
              never sets its own.
            </p>
          </Panel>

          <IntegrationsCard integrations={integrations} />

          {footer}
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {/* WHATSAPP                                                   */}
      {/* ---------------------------------------------------------- */}
      {active === "whatsapp" && (
        <div className="space-y-5">
          <Panel
            title="WhatsApp Cloud API"
            subtitle="Credentials from Meta › WhatsApp › API Setup"
            icon={MessageCircle}
            hue="mint"
          >
            <ToggleSetting
              spec={schema.whatsapp_enabled}
              checked={draft.whatsapp_enabled}
              onChange={(v) => setField("whatsapp_enabled", v)}
              disabled={saving}
            />

            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextSetting
                spec={schema.whatsapp_phone_number_id}
                value={draft.whatsapp_phone_number_id}
                onChange={(v) => setField("whatsapp_phone_number_id", v)}
              />
              <TextSetting
                spec={schema.whatsapp_api_version}
                value={draft.whatsapp_api_version}
                onChange={(v) => setField("whatsapp_api_version", v)}
              />
              <TextSetting
                spec={schema.whatsapp_template_name}
                value={draft.whatsapp_template_name}
                onChange={(v) => setField("whatsapp_template_name", v)}
              />
              <TextSetting
                spec={schema.whatsapp_template_language}
                value={draft.whatsapp_template_language}
                onChange={(v) => setField("whatsapp_template_language", v)}
              />
            </div>

            <div className="mt-5">
              <SecretSetting
                spec={schema.whatsapp_access_token}
                stored={payload.settings.whatsapp_access_token !== ""}
                value={draft.whatsapp_access_token}
                onChange={(v) => setField("whatsapp_access_token", v)}
              />
            </div>
          </Panel>

          <Panel title="Who receives it" subtitle="One number per institution" icon={Users} hue="sky">
            <p className="text-sm text-neutral-600">
              Turning this on makes the channel available platform-wide. Nothing reaches an
              institution until <span className="font-semibold">its own admin adds a WhatsApp
              number</span> on their Branding page: one number for the institution, not one per
              admin.
            </p>
            <p className="mt-3 text-sm text-neutral-500">
              Messages go out alongside the existing email and in-app licence reminders. They never
              replace them: WhatsApp is the nudge, email is the record.
            </p>
          </Panel>

          {footer}
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {/* NOTIFICATIONS                                              */}
      {/* ---------------------------------------------------------- */}
      {active === "notifications" && (
        <div className="space-y-5">
          <Panel
            title="What the platform sends"
            subtitle="Each switch turns a real message on or off"
            icon={Bell}
            hue="coral"
          >
            <div className="space-y-5">
              {notificationSections(schema).map((section) => (
                <section key={section.key} aria-labelledby={`notify-${section.key}`}>
                  <h3
                    id={`notify-${section.key}`}
                    className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500"
                  >
                    {section.title}
                  </h3>
                  <div className="divide-y divide-neutral-100">
                    {section.keys.map((key) => (
                      <ToggleSetting
                        key={key}
                        spec={schema[key]}
                        checked={Boolean(draft[key])}
                        onChange={(v) => setDraft((d) => (d ? { ...d, [key]: v } : d))}
                        disabled={saving}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Panel>

          {footer}
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {/* ADMINS                                                     */}
      {/* ---------------------------------------------------------- */}
      {active === "team" && <TeamPane />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Revenue split preview                                              */
/* ------------------------------------------------------------------ */

function SplitBar({ feePercent }: { feePercent: number }) {
  const instructorPercent = 100 - feePercent;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-medium">
        <span className="text-primary-700">Instructor keeps {instructorPercent}%</span>
        <span className="text-sun-700">Platform keeps {feePercent}%</span>
      </div>
      <div
        className="flex h-4 gap-1 overflow-hidden rounded-full"
        role="img"
        aria-label={`Instructors keep ${instructorPercent} percent of every sale, the platform keeps ${feePercent} percent`}
      >
        <div className="rounded-full bg-primary-500" style={{ width: `${instructorPercent}%` }} />
        <div className="rounded-full bg-sun-400" style={{ width: `${feePercent}%` }} />
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        On a ₦100,000 course the instructor earns{" "}
        <span className="tnum">₦{(instructorPercent * 1000).toLocaleString("en-NG")}</span>.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Integrations — measured from the deployment, not editable here     */
/* ------------------------------------------------------------------ */

function IntegrationsCard({ integrations }: { integrations: Integration[] }) {
  return (
    <Panel
      title="Connected services"
      subtitle="Set with environment variables on the server, never from this page"
      icon={Plug}
      hue="sky"
      bodyClassName="px-5 pb-5 pt-3"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {integrations.map((it) => (
          <div key={it.name} className="flex gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4">
            <span
              className={cx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                it.connected ? "bg-mint-50 text-mint-700" : "bg-sun-50 text-sun-700",
              )}
            >
              <KeyRound size={16} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-neutral-900">{it.name}</p>
                {it.connected ? (
                  <Chip hue="mint" icon={BadgeCheck}>
                    Connected
                  </Chip>
                ) : (
                  <Chip hue="sun" dot>
                    Not configured
                  </Chip>
                )}
              </div>
              <p className="mt-0.5 text-xs text-neutral-600">{it.purpose}</p>
              <p className="mt-0.5 break-all text-xs text-neutral-500">{it.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Admin roster                                                       */
/* ------------------------------------------------------------------ */

function TeamPane() {
  const confirm = useConfirm();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let alive = true;

    teamApi
      .list()
      .then((rows) => {
        if (alive) setMembers(rows);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Could not load the admin roster.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  async function add() {
    if (!name.trim() || !email.trim() || busy) return;

    setBusy(true);
    setError(null);
    try {
      // Omitted entirely rather than sent empty: the API only generates an
      // unusable random password when the key is absent.
      await teamApi.add({
        name: name.trim(),
        email: email.trim(),
        ...(password ? { password } : {}),
      });
      setMembers(await teamApi.list());
      setName("");
      setEmail("");
      setPassword("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add that admin.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(member: TeamMember) {
    if (busy) return;

    const ok = await confirm({
      title: `Remove ${member.name}'s admin access?`,
      // The API demotes them to User; it used to delete the account while this
      // dialog promised it wouldn't.
      body: `${member.name} becomes a User: they keep signing in, keep their roles and their work, but can no longer run the organisation console. Their account isn't deleted and nothing goes to the recycle bin; add them as an admin again to give it back.`,
      confirmLabel: "Remove admin access",
    });
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      await teamApi.remove(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setNotice(`${member.name} is now a User. Their account and work are unchanged.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove that admin.");
    } finally {
      setBusy(false);
    }
  }

  const blockedReason = (m: TeamMember) =>
    m.isYou
      ? "You cannot remove your own admin access"
      : members.length <= 1
        ? "The organisation must keep at least one admin"
        : undefined;

  const removeButton = (m: TeamMember) => {
    const blocked = blockedReason(m);
    return (
      <Button
        size="sm"
        icon={Trash2}
        onClick={() => void remove(m)}
        disabled={busy || blocked !== undefined}
        title={blocked ?? "Remove admin access"}
        className="hover:!border-error-500/30 hover:!bg-error-500/5 hover:!text-error-700"
      >
        Remove
      </Button>
    );
  };

  const nameCell = (m: TeamMember) => (
    <span className="flex min-w-0 items-center gap-3">
      <FaceAvatar name={m.name} size={36} />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-neutral-900">{m.name}</span>
          {m.isYou && <Chip hue="sky">You</Chip>}
        </span>
        <span className="block truncate text-xs text-neutral-500">{m.email}</span>
      </span>
    </span>
  );

  const columns: Column<TeamMember>[] = [
    { key: "name", header: "Admin", primary: true, sortable: true, value: (m) => m.name, render: nameCell },
    {
      key: "joined",
      header: "Joined",
      sortable: true,
      value: (m) => m.joined ?? "",
      render: (m) => <span className="text-sm text-neutral-600">{formatDate(m.joined)}</span>,
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: removeButton },
  ];

  return (
    <div className="space-y-5">
      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}

      <Panel
        title="Admins"
        subtitle="Everyone who runs this organisation's console"
        icon={ShieldCheck}
        hue="grape"
        actions={
          adding ? undefined : (
            <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
              Add admin
            </Button>
          )
        }
      >
        {adding && (
          <div className="mb-5 rounded-xl border border-neutral-200/80 bg-neutral-50/60">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="mb-1.5 block text-sm font-medium text-neutral-700">Full name</span>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="flex-1">
                <span className="mb-1.5 block text-sm font-medium text-neutral-700">Email</span>
                <input
                  type="email"
                  className={INPUT_CLASS}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="flex-1">
                <span className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Temporary password
                </span>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  value={password}
                  autoComplete="off"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => void add()}
                  disabled={busy || !name.trim() || !email.trim()}
                >
                  {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <UserPlus size={15} aria-hidden />}
                  Add
                </Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
            <p className="flex items-start gap-2 px-4 pb-4 text-xs text-neutral-600">
              <Mail size={13} className="mt-0.5 shrink-0" aria-hidden />
              An existing member of this organisation with this email keeps their password and is
              promoted. For a new
              account, set a temporary password and share it; they&apos;re asked to replace it at first
              sign-in, and can always use “Forgot password?” on the sign-in page to get a reset link by
              email. Anyone who teaches keeps their courses.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-neutral-500">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Loading admins…
          </div>
        ) : (
          <DataView
            rows={members}
            columns={columns}
            rowKey={(m) => m.id}
            storageKey="org.settings.admins"
            defaultView="list"
            caption="Admins"
            searchPlaceholder="Search admins"
            empty={
              members.length === 0 ? (
                <Empty icon={UserPlus} title="No admins" hint="Add someone to run this organisation's console." />
              ) : undefined
            }
            renderCard={(m) => (
              <div className="flex h-full flex-col gap-4 p-5">
                {nameCell(m)}
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  <span>Joined {formatDate(m.joined)}</span>
                  {removeButton(m)}
                </div>
              </div>
            )}
            renderListItem={(m) => (
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  {nameCell(m)}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="hidden text-xs text-neutral-500 sm:inline">Joined {formatDate(m.joined)}</span>
                  {removeButton(m)}
                </div>
              </div>
            )}
          />
        )}
      </Panel>

      <p className="text-xs text-neutral-500">
        Admins hold the Organisation admin role. What everybody else can do comes from the roles
        they hold: give roles from Users, and change what a role allows from Roles.
      </p>
    </div>
  );
}
