"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Palette,
  Check,
  CheckCircle2,
  TriangleAlert,
  Building2,
  BookOpen,
  Eye,
  IdCard,
  ImageIcon,
  LayoutDashboard,
  MessageCircle,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { Button, Card, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { ErrorNote, hintClass, inputClass, labelClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { ApiError } from "@/lib/api/saas-client";
import { useAuth } from "@/lib/auth-store";
import { PLATFORM_ACCENT, brandInitials } from "@/lib/branding";
import ThumbnailUploader from "@/suite/lms/components/instructor/ThumbnailUploader";

/**
 * An institution's own identity.
 *
 * The screen is built around a live preview because an accent colour cannot be
 * judged from a hex code, the question an admin is actually asking is "does
 * our sidebar look right", and the only honest way to answer it is to show the
 * sidebar.
 *
 * Contrast is checked as they type, using the same WCAG maths the API enforces
 * on save. Telling them a colour is too pale while they are choosing it is the
 * difference between a two-second correction and every member of the
 * institution getting an interface they cannot read.
 */

interface BrandingState {
  name: string;
  description: string;
  whatsappNumber: string;
  logoUrl: string | null;
  accentColor: string;
}

export default function BrandingPage() {
  const { user, refresh } = useAuth();

  const [form, setForm] = useState<BrandingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const belongsToOrganisation = Boolean(user?.organisationId);

  const load = useCallback(() => {
    fetch("/api/admin/organisation", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load"))))
      .then((body) => {
        const org = body.data;
        setForm({
          name: org.name ?? "",
          description: org.description ?? "",
          whatsappNumber: org.whatsappNumber ?? "",
          logoUrl: org.logoUrl ?? null,
          accentColor: org.accentColor ?? PLATFORM_ACCENT,
        });
        setError(null);
      })
      .catch(() => setError("Your organisation's branding didn't load."));
  }, []);

  useEffect(() => {
    if (belongsToOrganisation) load();
  }, [belongsToOrganisation, load]);

  const contrast = useMemo(
    () => (form ? contrastWithWhite(form.accentColor) : null),
    [form],
  );

  const accentIsLegible = contrast === null || contrast >= 4.5;
  const canSave = form !== null && form.name.trim().length > 1 && accentIsLegible && !saving;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !form) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/admin/organisation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          // Empty means "send us nothing", which is a real choice rather than
          // an unfinished form, so it is sent as null rather than skipped.
          whatsappNumber: form.whatsappNumber.trim() || null,
          logoUrl: form.logoUrl,
          accentColor: form.accentColor,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new ApiError(body?.message ?? "Couldn't save.", res.status, body?.errors);
      }

      setSaved(true);
      // The shells read branding from the session, so it has to be re-read for
      // the sidebar to change without a reload.
      await refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.errors?.accentColor?.[0] ?? err.message)
          : "Your branding didn't save.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (user && !belongsToOrganisation) {
    return (
      <Card>
        <Empty
          icon={Building2}
          title="Branding belongs to an organisation"
          hint="Your account runs the platform rather than one organisation. Open an organisation from the Organisations page to change how it looks."
        />
      </Card>
    );
  }

  return (
    <form onSubmit={save}>
      <PageHeader
        eyebrow="Institution"
        title="Branding"
        subtitle="Your logo, name and accent, on your console and on every certificate you issue."
        actions={
          <Button type="submit" variant="primary" disabled={!canSave}>
            {saving ? "Saving…" : "Save branding"}
          </Button>
        }
      />

      {error && <ErrorNote className="mb-5">{error}</ErrorNote>}

      {saved && (
        <p
          role="status"
          className="mb-6 flex items-center gap-3 rounded-2xl bg-mint-50 px-4 py-3 text-sm font-medium text-mint-700"
        >
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
          Saved. Your console has been updated.
        </p>
      )}

      {form === null ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" role="status" aria-busy="true">
          <span className="sr-only">Loading branding</span>
          <div className="h-96 animate-pulse rounded-[1.25rem] bg-neutral-200/60 motion-reduce:animate-none lg:col-span-2" />
          <div className="h-96 animate-pulse rounded-[1.25rem] bg-neutral-200/60 motion-reduce:animate-none" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Panel title="Identity" subtitle="Who you are, wherever your name appears." icon={IdCard}>
              <div className="space-y-5">
                <div>
                  <label htmlFor="org-name" className={labelClass}>
                    Institution name <span className="text-error-600">*</span>
                  </label>
                  <input
                    id="org-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={255}
                    aria-describedby="org-name-help"
                    className={inputClass}
                  />
                  <p id="org-name-help" className={hintClass}>
                    Appears in your console and on certificates that name no template.
                  </p>
                </div>

                <div>
                  <label htmlFor="org-description" className={labelClass}>
                    Description
                  </label>
                  <textarea
                    id="org-description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    maxLength={2000}
                    className={cx(textareaClass, "resize-y")}
                  />
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
              <Panel title="Logo" subtitle="Shown in the sidebar and on certificates." icon={ImageIcon} hue="grape">
                {/*
                  Re-uses the course cover uploader, same Cloudinary path, same
                  size and type guards. `gradient` is part of its value shape for
                  course tiles and is irrelevant here, so it is passed through
                  untouched.
                */}
                <ThumbnailUploader
                  value={{ gradient: "", thumbnailUrl: form.logoUrl, thumbnailPublicId: null }}
                  onChange={(next) => setForm({ ...form, logoUrl: next.thumbnailUrl })}
                />
                <p className={cx(hintClass, "mt-3")}>
                  A wide logo on a transparent background works best. Without one, your initials show
                  in your accent colour.
                </p>
              </Panel>

              <Panel title="Accent colour" subtitle="Used for the active item in your sidebar." icon={Palette} hue="coral">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="accent-picker" className={labelClass}>
                      Pick a colour
                    </label>
                    <input
                      id="accent-picker"
                      type="color"
                      value={form.accentColor}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      className="h-11 w-16 cursor-pointer rounded-xl border border-neutral-200 bg-white p-1"
                    />
                  </div>

                  <div>
                    <label htmlFor="accent-hex" className={labelClass}>
                      Or type a hex
                    </label>
                    <input
                      id="accent-hex"
                      value={form.accentColor}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      maxLength={7}
                      spellCheck={false}
                      className={cx(inputClass, "w-32 font-mono uppercase")}
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => setForm({ ...form, accentColor: PLATFORM_ACCENT })}
                  className="mt-3"
                >
                  Reset to default
                </Button>

                {/*
                  Checked as they type with the same WCAG maths the API enforces
                  on save, so the refusal never comes as a surprise at the end.
                */}
                {contrast !== null && (
                  <p
                    role="status"
                    className={cx(
                      "mt-4 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm",
                      accentIsLegible ? "bg-mint-50 text-mint-700" : "bg-error-500/5 text-error-700",
                    )}
                  >
                    {accentIsLegible ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      Contrast with white text is{" "}
                      <strong className="tabular-nums">{contrast.toFixed(1)}:1</strong>.{" "}
                      {accentIsLegible
                        ? "That reads clearly."
                        : "That is below the 4.5:1 minimum. Pick a darker shade before saving."}
                    </span>
                  </p>
                )}
              </Panel>
            </div>

            <Panel
              title="WhatsApp"
              subtitle="Where licence notices reach you, if your platform administrator has the channel on."
              icon={MessageCircle}
              hue="mint"
            >
              <label htmlFor="org-whatsapp" className={labelClass}>
                WhatsApp number
              </label>
              <input
                id="org-whatsapp"
                type="tel"
                inputMode="tel"
                value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                maxLength={24}
                placeholder="+234 803 555 0101"
                aria-describedby="org-whatsapp-help"
                className={cx(inputClass, "sm:max-w-sm")}
              />
              <p id="org-whatsapp-help" className={hintClass}>
                One number for your whole organisation. A shared operations line works well. Include
                the country code. Leave it empty and nothing is sent. Your email and in-app alerts
                carry on either way.
              </p>
            </Panel>
          </div>

          {/*
            The preview is the point of this screen: an accent cannot be judged
            from a hex code, only from the thing it colours.
          */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Panel title="Preview" subtitle="How your sidebar will look." icon={Eye} hue="sky">
              <SidebarPreview
                name={form.name || "Your institution"}
                logoUrl={form.logoUrl}
                accent={form.accentColor}
                foreground={readableForeground(form.accentColor)}
              />
            </Panel>
          </div>
        </div>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */

function SidebarPreview({
  name,
  logoUrl,
  accent,
  foreground,
}: {
  name: string;
  logoUrl: string | null;
  accent: string;
  foreground: string;
}) {
  const items = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Courses", icon: BookOpen },
    { label: "Students", icon: Users },
  ];

  return (
    <div
      className="overflow-hidden rounded-[1.25rem] border border-neutral-100 bg-white shadow-md shadow-primary-900/5"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-9 w-auto max-w-[7rem] rounded-lg object-contain" />
        ) : (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
            style={{ background: accent, color: foreground }}
          >
            {brandInitials(name)}
          </span>
        )}
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-bold text-neutral-900">{name}</span>
          <span className="block text-xs text-neutral-500">Learning</span>
        </span>
      </div>

      <div className="px-3 pt-3">
        <div className="flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-400">
          <Search size={13} />
          Find a page
        </div>
      </div>

      <p className="px-6 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        General
      </p>
      <div className="space-y-0.5 px-3 pb-4">
        {items.map(({ label, icon: Icon }, index) => (
          <div
            key={label}
            className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", index !== 0 && "text-neutral-600")}
            style={index === 0 ? { background: accent, color: foreground } : undefined}
          >
            <Icon size={17} className="shrink-0" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Contrast, the same WCAG maths the API enforces on save            */
/* ------------------------------------------------------------------ */

function contrastWithWhite(hex: string): number | null {
  const rgb = parseHex(hex);
  if (rgb === null) return null;

  const lum = relativeLuminance(rgb);

  return (1.0 + 0.05) / (lum + 0.05);
}

function readableForeground(hex: string): string {
  const contrast = contrastWithWhite(hex);
  return contrast !== null && contrast >= 4.5 ? "#ffffff" : "#0f172a";
}

function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");

  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;

  const full =
    hex.length === 3
      ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      : hex;

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
