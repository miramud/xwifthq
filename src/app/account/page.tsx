"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  Check,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Save,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  accountProfile,
  password as passwordApi,
  uploadAvatar,
  ApiError,
} from "@/lib/api/account-client";
import { TwoStepVerification } from "@/components/account/TwoStepVerification";

/* ------------------------------------------------------------------ */
/*  primitives                                                         */
/* ------------------------------------------------------------------ */

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";

type TabKey = "profile" | "security";

const TABS: { key: TabKey; label: string; icon: typeof UserIcon }[] = [
  { key: "profile", label: "Profile", icon: UserIcon },
  { key: "security", label: "Security", icon: ShieldCheck },
];

function Card({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900" style={{ fontFamily: "var(--font-heading)" }}>
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-neutral-400">{subtitle}</p>}
      </header>
      <div className="p-5">{children}</div>
      {footer}
    </section>
  );
}

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
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-neutral-600">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : Check;

  return (
    <p
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-error-500/30 bg-error-500/10 text-error-600"
          : "border-success-500/30 bg-success-500/10 text-success-700"
      }`}
    >
      <Icon size={15} className="shrink-0" />
      {children}
    </p>
  );
}

function InitialsTile({ name, size = 80 }: { name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-primary-600 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, refresh, logout } = useAuth();
  const [active, setActive] = useState<TabKey>("profile");

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  useEffect(() => {
    document.title = "Account | Elevate";
    // Deep link from an approval that needs a code: /account?tab=security.
    if (new URLSearchParams(window.location.search).get("tab") === "security") setActive("security");
  }, []);

  if (loading) {
    return (
      <section className="section-container section-padding">
        <div className="flex items-center gap-2 py-20 text-sm text-neutral-400">
          <Loader2 size={16} className="animate-spin" />
          Loading your account…
        </div>
      </section>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="section-container section-padding text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary-50">
            <Lock size={40} className="text-primary-400" />
          </div>
          <h1 className="heading-3 mb-3 text-neutral-900" style={{ fontFamily: "var(--font-heading)" }}>
            Sign in to manage your account
          </h1>
          <p className="mb-8 text-neutral-500">
            Your profile, purchase history and password all live here.
          </p>
          <Link href="/login" className="btn-primary">
            Log In
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section-container section-padding">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="heading-3 text-neutral-900" style={{ fontFamily: "var(--font-heading)" }}>
              Account
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Manage your profile, review what you have bought, and change your password.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-error-300 hover:bg-error-50 hover:text-error-600"
          >
            <LogOut size={16} />
            Log out
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const on = active === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  on
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {active === "profile" && (
          <ProfilePane
            name={user.name}
            email={user.email}
            avatar={user.avatar}
            onSaved={() => void refresh()}
          />
        )}
        {active === "security" && <SecurityPane />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile                                                            */
/* ------------------------------------------------------------------ */

function ProfilePane({
  name,
  email,
  avatar,
  onSaved,
}: {
  name: string;
  email: string;
  avatar: string | null;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [draftName, setDraftName] = useState(name);
  const [draftAvatar, setDraftAvatar] = useState<{ url: string | null; publicId: string | null }>({
    url: avatar,
    publicId: null,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const avatarChanged = draftAvatar.url !== avatar;
  const dirty = draftName.trim() !== name || avatarChanged;

  async function pick(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const asset = await uploadAvatar(file);
      setDraftAvatar({ url: asset.url, publicId: asset.publicId });
      setSaved(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not upload that image.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function save() {
    if (!dirty || saving) return;

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await accountProfile.update({
        ...(draftName.trim() !== name ? { name: draftName.trim() } : {}),
        // Both move together, and an explicit null clears the photo.
        ...(avatarChanged
          ? { avatarUrl: draftAvatar.url, avatarPublicId: draftAvatar.publicId }
          : {}),
      });
      setSaved(true);
      // The navbar and every greeting read the user from the auth store.
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraftName(name);
    setDraftAvatar({ url: avatar, publicId: null });
    setError(null);
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      {error && <Banner tone="error">{error}</Banner>}
      {saved && !dirty && <Banner tone="success">Profile saved.</Banner>}

      <Card
        title="Your profile"
        subtitle="How you appear across Elevate."
        footer={
          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-4">
            <button
              type="button"
              onClick={discard}
              disabled={!dirty || saving}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="btn-primary gap-2 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {draftAvatar.url ? (
              // Cloudinary serves these from an arbitrary host; next/image would
              // need a remotePatterns entry per cloud.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draftAvatar.url}
                alt={draftName}
                width={80}
                height={80}
                className="h-20 w-20 shrink-0 rounded-full object-cover"
              />
            ) : (
              <InitialsTile name={draftName} />
            )}

            <div className="text-center sm:text-left">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(e) => void pick(e.target.files?.[0])}
              />
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  {uploading ? "Uploading…" : draftAvatar.url ? "Change photo" : "Upload photo"}
                </button>
                {draftAvatar.url && (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setDraftAvatar({ url: null, publicId: null })}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 transition-colors hover:text-error-600"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">JPG, PNG, WebP or AVIF · max 2 MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="name">
              <input
                id="name"
                type="text"
                maxLength={255}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>

            <Field
              label="Email"
              htmlFor="email"
              hint="This is how you sign in and it cannot be changed here."
            >
              <div className="relative">
                <input id="email" type="email" value={email} readOnly disabled className={INPUT_CLASS} />
                <Lock
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300"
                />
              </div>
            </Field>
          </div>
        </div>
      </Card>

      <p className="text-xs text-neutral-400">
        Elevate emails you a receipt for every purchase, and tells you if a payment fails or an
        enrollment is refunded. Those are records of your money, so there is nothing to switch off.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Security                                                           */
/* ------------------------------------------------------------------ */

function SecurityPane() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ready = current !== "" && next.length >= 8 && next === confirm;

  const submit = useCallback(async () => {
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
      setError(e instanceof ApiError ? e.message : "Could not change your password.");
    } finally {
      setBusy(false);
    }
  }, [ready, busy, current, next, confirm]);

  return (
    <div className="space-y-6">
      {error && <Banner tone="error">{error}</Banner>}
      {done && (
        <Banner tone="success">
          Password updated. Every other signed-in device has been signed out.
        </Banner>
      )}

      <Card
        title="Password"
        subtitle="Use a strong, unique password of at least 8 characters."
        footer={
          <div className="flex flex-col gap-3 border-t border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-400">
              Forgotten it? Use “Forgot password?” on the sign-in page to get a reset link by email.
            </p>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!ready || busy}
              className="btn-primary gap-2 self-start px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {busy ? "Updating…" : "Update password"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            hint={confirm !== "" && confirm !== next ? "The two passwords do not match." : undefined}
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
      </Card>

      <TwoStepVerification />
    </div>
  );
}
