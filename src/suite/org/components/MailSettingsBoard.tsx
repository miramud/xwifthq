"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  AlertCircle,
  AtSign,
  Building2,
  Check,
  Cloud,
  Eye,
  EyeOff,
  Inbox,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  Send,
  Server,
  Settings2,
  Stamp,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Dialog, Field, INPUT } from "@/suite/hrm/components/console/Dialog";
import { useAuth } from "@/lib/auth-store";
import {
  ApiError,
  mailSettings,
  optionLabel,
  optionValue,
  platformMailSettings,
  type MailField,
  type MailProvider,
  type MailSettings,
  type MailSettingsClient,
} from "@/lib/api/mail-settings-client";

/* ------------------------------------------------------------------ */
/*  Two scopes, one board                                              */
/* ------------------------------------------------------------------ */

/**
 * Whose mail this board configures. The organisation console and the Platform
 * console share every form, guard rail and test flow; only the words differ,
 * and the API they call. Mail to a member of an organisation goes through the
 * organisation's provider, then the platform's, then the server's default
 * mail settings — each scope's copy says where it sits in that order.
 */
export type MailScope = "organisation" | "platform";

interface MailCopy {
  eyebrow: string;
  subtitle: string;
  forbiddenTitle: string;
  forbiddenHint: string;
  fallbackName: string;
  noneActiveTitle: string;
  noneActiveBody: string;
  activeBody: string;
  activeStatus: string;
  switchedOn: (label: string) => string;
  removeActiveTail: string;
  fromNameExample: string;
}

const COPY: Record<MailScope, MailCopy> = {
  organisation: {
    eyebrow: "Institution",
    subtitle: "Choose the service that sends your organisation's invitations, assignments and reminders.",
    forbiddenTitle: "Only organisation admins can change email delivery",
    forbiddenHint:
      "Ask an admin to set up a provider. Your own email notifications can still be turned on or off from your notification settings.",
    fallbackName: "Platform default",
    noneActiveTitle: "Using the platform's default sender",
    noneActiveBody:
      "No provider is switched on, so your emails go out from the platform's own address. They still arrive — set up your own provider to send from your organisation's domain.",
    activeBody:
      "Every email to people in this organisation goes out through this provider. If it fails, the email is logged and the action that triggered it still completes.",
    activeStatus: "Switched on. Every email goes out through here.",
    switchedOn: (label) => `Switched on. Your organisation's email now goes through ${label}.`,
    removeActiveTail: " Until you switch another provider on, email goes out from the platform's default sender.",
    fromNameExample: "Meridian Polytechnic",
  },
  platform: {
    eyebrow: "Platform",
    subtitle:
      "Choose the service that sends the platform's own email: welcomes for new organisations, sales and owner notices, and mail for people who don't belong to an organisation.",
    forbiddenTitle: "Only the platform owner can change platform email",
    forbiddenHint: "Ask the platform owner, or someone whose platform role includes settings, to set up a provider.",
    fallbackName: "Server default",
    noneActiveTitle: "Using the server's default mail settings",
    noneActiveBody:
      "No platform provider is switched on, so platform email uses the mail settings in the server's configuration. If those aren't set up for real delivery, onboarding and sales emails won't arrive — set up a provider here and send a test.",
    activeBody:
      "Onboarding welcomes, sales and owner notices, and mail for people outside any organisation go out through this provider. It also carries mail for organisations that haven't switched on a provider of their own.",
    activeStatus: "Switched on. Platform email goes out through here.",
    switchedOn: (label) => `Switched on. Platform email now goes through ${label}.`,
    removeActiveTail: " Until you switch another provider on, platform email uses the server's default mail settings.",
    fromNameExample: "Elevate",
  },
};

/**
 * How this organisation's email leaves the platform.
 *
 * Every invitation, course assignment, appraisal reminder and project update
 * addressed to somebody here goes out through the provider chosen on this
 * screen. With none switched on, mail still goes — through the platform's
 * default sender — and the page says so plainly, because "are our emails even
 * working?" is the question an administrator arrives with.
 *
 * The forms are rendered from the API's own field schema, so SMTP's host and
 * port, Resend's key and Microsoft's tenant and client ids all come from one
 * place and cannot drift from what the backend expects.
 *
 * Three guard rails, in the order somebody meets them:
 *
 *  - **A secret is never shown again.** Password fields start empty; a stored
 *    one is kept when the box is left blank, and the hint says so.
 *  - **A provider must send a real test email before it can be switched on.**
 *    The button is disabled with the reason, not hidden: a provider that was
 *    saved but never proved would otherwise swallow every invitation silently.
 *  - **Removing credentials is final.** They are erased, not binned — a
 *    credential in a recycle bin is a leaked credential waiting to happen.
 */
export default function MailSettingsBoard({ scope = "organisation" }: { scope?: MailScope }) {
  const { user } = useAuth();
  const copy = COPY[scope];
  // Named imports, so a test's mock of either client applies here.
  const api: MailSettingsClient = scope === "platform" ? platformMailSettings : mailSettings;
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<MailProvider | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get()
      .then((s) => {
        if (!alive) return;
        setSettings(s);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof ApiError ? e.message : "Email settings didn't load.");
      });
    return () => {
      alive = false;
    };
  }, [reloads, api]);

  const retry = useCallback(() => {
    setError(null);
    setReloads((n) => n + 1);
  }, []);

  const header = (
    <PageHeader eyebrow={copy.eyebrow} title="Email delivery" subtitle={copy.subtitle} />
  );

  if (forbidden) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <Empty
            icon={Lock}
            hue="sun"
            title={copy.forbiddenTitle}
            hint={copy.forbiddenHint}
          />
        </Card>
      </div>
    );
  }

  if (settings === null) {
    return (
      <div className="space-y-6">
        {header}
        {error !== null ? (
          <Card>
            <Empty
              icon={AlertCircle}
              hue="coral"
              title="Email settings didn't load"
              hint={error}
              action={
                <Button size="sm" icon={RotateCcw} onClick={retry}>
                  Try again
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-5" aria-busy="true" aria-label="Loading email settings">
            <div className="h-40 animate-pulse rounded-[1.125rem] bg-neutral-200/60" />
            <div className="grid gap-5 lg:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-[1.125rem] bg-neutral-200/60" />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const active = settings.providers.find((p) => p.key === settings.active) ?? null;

  return (
    <div className="space-y-6">
      {header}

      <RouteCard settings={settings} active={active} copy={copy} />

      {scope === "platform" && <RoutingOrder routing={typeof settings.routing === "string" ? settings.routing : null} />}

      <section aria-labelledby="mail-providers-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="mail-providers-heading" className="text-base font-bold tracking-tight text-neutral-900">
            Providers
          </h2>
          <p className="text-xs text-neutral-500">Save the details, send a test, then switch it on.</p>
        </div>
        <ul className="grid gap-5 lg:grid-cols-2">
          {settings.providers.map((provider) => (
            <li key={provider.key}>
              <ProviderCard
                provider={provider}
                isActive={provider.key === settings.active}
                defaultRecipient={user?.email ?? ""}
                api={api}
                copy={copy}
                onConfigure={() => setEditing(provider)}
                onChanged={setSettings}
                onRemoved={retry}
              />
            </li>
          ))}
        </ul>
      </section>

      {editing !== null && (
        <ConfigureDialog
          provider={editing}
          settings={settings}
          api={api}
          copy={copy}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setSettings(next);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The route mail takes right now                                     */
/* ------------------------------------------------------------------ */

/**
 * The page's answer before any form: what a recipient actually sees in the
 * From line, and which service carried it. Set as an email header because
 * that is exactly what it is.
 */
function RouteCard({ settings, active, copy }: { settings: MailSettings; active: MailProvider | null; copy: MailCopy }) {
  const look = active ? providerLook(active.key) : { icon: Mail, hue: "slate" as Hue };
  const Icon = look.icon;
  const from =
    settings.fromAddress !== null && settings.fromAddress !== ""
      ? `${settings.fromName ? `${settings.fromName} ` : ""}<${settings.fromAddress}>`
      : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className={cx("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", HUE[look.hue].tile)}>
            <Icon size={24} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Right now</p>
            <h2 className="text-lg font-bold tracking-tight text-neutral-900">
              {active === null ? copy.noneActiveTitle : `Sending through ${active.label}`}
            </h2>
            <p className="mt-1 max-w-prose text-sm text-neutral-600">
              {active === null ? copy.noneActiveBody : copy.activeBody}
            </p>
          </div>
        </div>

        <dl
          className="grid min-w-0 shrink-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-xs lg:w-[22rem]"
          aria-label="What recipients see"
        >
          <dt className="text-neutral-500">From</dt>
          <dd className="min-w-0 truncate text-neutral-900" title={from ?? undefined}>
            {from ?? <span className="text-neutral-500">{copy.fallbackName}</span>}
          </dd>
          <dt className="text-neutral-500">Reply-To</dt>
          <dd className="min-w-0 truncate text-neutral-900">
            {settings.replyTo ?? <span className="text-neutral-500">Same as From</span>}
          </dd>
          <dt className="text-neutral-500">Via</dt>
          <dd className="min-w-0 truncate text-neutral-900">{active?.label ?? copy.fallbackName}</dd>
        </dl>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Platform scope: the order mail is routed in                        */
/* ------------------------------------------------------------------ */

const ROUTING_STEPS: { title: string; body: string }[] = [
  {
    title: "The organisation's own provider",
    body: "When an organisation has switched one on, its members' mail goes through it, from its own domain.",
  },
  {
    title: "This platform provider",
    body: "Onboarding welcomes, sales and owner notices, mail for people outside any organisation, and any organisation without a provider of its own.",
  },
  {
    title: "The server's default mail settings",
    body: "Used only when neither of the above is switched on. Check with your technical team that they deliver real email.",
  },
];

/**
 * Where platform mail sits in the order, in plain words, so an owner can tell
 * which address a given email came from. The API's own routing sentence, when
 * it sends one, is shown underneath as the authoritative version.
 */
function RoutingOrder({ routing }: { routing: string | null }) {
  return (
    <Card>
      <div className="p-5 sm:p-6">
        <h2 className="text-base font-bold tracking-tight text-neutral-900">How email finds its way out</h2>
        <p className="mt-1 text-sm text-neutral-600">Each email uses the first of these that is switched on.</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {ROUTING_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white"
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        {routing !== null && routing !== "" && (
          <p className="mt-4 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-700">Right now: </span>
            {routing}
          </p>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  One provider                                                       */
/* ------------------------------------------------------------------ */

const PROVIDER_LOOK: Record<string, { icon: LucideIcon; hue: Hue }> = {
  smtp: { icon: Server, hue: "slate" },
  gmail: { icon: Mail, hue: "coral" },
  resend: { icon: Send, hue: "grape" },
  zeptomail: { icon: Zap, hue: "sun" },
  microsoft: { icon: Building2, hue: "sky" },
  mailgun: { icon: Inbox, hue: "rose" },
  postmark: { icon: Stamp, hue: "sun" },
  ses: { icon: Cloud, hue: "blue" },
};

function providerLook(key: string): { icon: LucideIcon; hue: Hue } {
  return PROVIDER_LOOK[key] ?? { icon: AtSign, hue: hueFor(key) };
}

function ProviderCard({
  provider,
  isActive,
  defaultRecipient,
  api,
  copy,
  onConfigure,
  onChanged,
  onRemoved,
}: {
  provider: MailProvider;
  isActive: boolean;
  defaultRecipient: string;
  api: MailSettingsClient;
  copy: MailCopy;
  onConfigure: () => void;
  onChanged: (next: MailSettings) => void;
  onRemoved: () => void;
}) {
  const confirm = useConfirm();
  const inputId = useId();
  const [busy, setBusy] = useState<"test" | "activate" | "remove" | null>(null);
  const [testing, setTesting] = useState(false);
  const [to, setTo] = useState(defaultRecipient);
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** A test sent from this screen counts even before the next reload. */
  const [testedNow, setTestedNow] = useState(false);

  const tested = testedNow || provider.verifiedAt !== null;
  const look = providerLook(provider.key);

  const run = async (key: "test" | "activate" | "remove", action: () => Promise<string | null>) => {
    setBusy(key);
    setProblem(null);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (e) {
      // The provider's own words, verbatim: "535 Authentication failed" tells
      // somebody far more than "that didn't work".
      setProblem(e instanceof ApiError || e instanceof Error ? e.message : "That didn't go through.");
    } finally {
      setBusy(null);
    }
  };

  const sendTest = (event: React.FormEvent) => {
    event.preventDefault();
    const recipient = to.trim();
    if (recipient === "") {
      setProblem("Enter an address to send the test to.");
      return;
    }
    void run("test", async () => {
      await api.test(provider.key, recipient);
      setTestedNow(true);
      setTesting(false);
      return `Test email sent to ${recipient}. Check the inbox, and the spam folder if it isn't there.`;
    });
  };

  const activate = () =>
    run("activate", async () => {
      onChanged(await api.activate(provider.key));
      return copy.switchedOn(provider.label);
    });

  const remove = async () => {
    const ok = await confirm({
      title: `Remove ${provider.label} credentials?`,
      body:
        "The credentials are erased for good — nothing goes to the recycle bin. To use " +
        `${provider.label} again you'll need to enter them again.` +
        (isActive ? copy.removeActiveTail : ""),
      confirmLabel: "Remove credentials",
    });
    if (!ok) return;
    await run("remove", async () => {
      await api.remove(provider.key);
      onRemoved();
      return null;
    });
  };

  return (
    <Panel
      title={provider.label}
      subtitle={statusLine(provider, isActive, tested, copy)}
      icon={look.icon}
      hue={look.hue}
      className={cx("h-full", isActive && "ring-2 ring-mint-100")}
      actions={<StatusChip provider={provider} isActive={isActive} tested={tested} />}
    >
      <div className="space-y-4">
        {problem !== null && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-500/5 px-3 py-2 text-sm text-error-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{problem}</span>
          </p>
        )}
        {message !== null && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-mint-50 px-3 py-2 text-sm text-mint-700">
            <Check size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{message}</span>
          </p>
        )}

        {testing && (
          <form onSubmit={sendTest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold text-neutral-700">
                Send a test email to
              </label>
              <input
                id={inputId}
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={INPUT}
                autoComplete="email"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" icon={busy === "test" ? Loader2 : Send} disabled={busy !== null}>
                {busy === "test" ? "Sending…" : "Send test"}
              </Button>
              <Button size="sm" onClick={() => setTesting(false)} disabled={busy === "test"}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
          <Button variant={provider.configured ? "secondary" : "primary"} size="sm" icon={Settings2} onClick={onConfigure} disabled={busy !== null}>
            {provider.configured ? "Edit details" : "Set up"}
          </Button>

          {provider.configured && !testing && (
            <Button size="sm" icon={Send} onClick={() => setTesting(true)} disabled={busy !== null}>
              Send test email
            </Button>
          )}

          {provider.configured && !isActive && (
            <Button
              size="sm"
              variant={tested ? "primary" : "secondary"}
              disabled={busy !== null || !tested}
              title={tested ? undefined : "Send a test email before switching this on."}
              onClick={() => void activate()}
            >
              {busy === "activate" ? "Switching on…" : "Switch on"}
            </Button>
          )}

          {provider.configured && (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              disabled={busy !== null}
              onClick={() => void remove()}
              className="!text-error-700 hover:!bg-error-500/5"
            >
              Remove
            </Button>
          )}
        </div>

        {provider.configured && !tested && !isActive && (
          <p className="text-xs text-neutral-500">Send a test email before switching this on.</p>
        )}
      </div>
    </Panel>
  );
}

function StatusChip({ provider, isActive, tested }: { provider: MailProvider; isActive: boolean; tested: boolean }) {
  if (isActive)
    return (
      <Chip hue="mint" icon={Check}>
        Sending
      </Chip>
    );
  if (!provider.configured) return <Chip hue="slate">Not set up</Chip>;
  if (!tested) return <Chip hue="sun">Not tested</Chip>;
  return <Chip hue="blue">Ready</Chip>;
}

function statusLine(provider: MailProvider, isActive: boolean, tested: boolean, copy: MailCopy): string {
  if (!provider.configured) return "Not set up.";
  if (isActive) return copy.activeStatus;
  if (!tested) return "Saved, but no test email has gone out yet.";
  return "Tested and ready. Not switched on.";
}

/* ------------------------------------------------------------------ */
/*  Configure                                                          */
/* ------------------------------------------------------------------ */

function ConfigureDialog({
  provider,
  settings,
  api,
  copy,
  onClose,
  onSaved,
}: {
  provider: MailProvider;
  settings: MailSettings;
  api: MailSettingsClient;
  copy: MailCopy;
  onClose: () => void;
  onSaved: (next: MailSettings) => void;
}) {
  const baseId = useId();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of provider.fields) {
      // Secrets never come back from the API; the box starts empty.
      initial[field.key] = field.type === "password" ? "" : (provider.values[field.key] ?? "");
    }
    return initial;
  });
  const [fromName, setFromName] = useState(settings.fromName ?? "");
  const [fromAddress, setFromAddress] = useState(settings.fromAddress ?? "");
  const [replyTo, setReplyTo] = useState(settings.replyTo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload: Record<string, string> = {};
    for (const field of provider.fields) {
      const value = values[field.key] ?? "";
      // A blank secret keeps the stored one, so it isn't sent at all.
      if (field.type === "password" && value === "") continue;
      payload[field.key] = value;
    }

    try {
      onSaved(
        await api.save(provider.key, {
          values: payload,
          fromName: fromName.trim(),
          fromAddress: fromAddress.trim(),
          replyTo: replyTo.trim() === "" ? null : replyTo.trim(),
        }),
      );
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.errors ?? {});
      } else {
        setError("The details weren't saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  const errorFor = (key: string) => fieldErrors[key]?.[0] ?? fieldErrors[`values.${key}`]?.[0];

  return (
    <Dialog
      title={`${provider.configured ? "Edit" : "Set up"} ${provider.label}`}
      subtitle="Saved details are encrypted. Secrets are never shown again."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Connection</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {provider.fields.map((field) => (
              <SchemaField
                key={field.key}
                id={`${baseId}-${field.key}`}
                field={field}
                stored={provider.configured}
                value={values[field.key] ?? ""}
                error={errorFor(field.key)}
                onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Sender</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`${baseId}-fromName`} label="From name" hint={`What recipients see, e.g. ${copy.fromNameExample}.`}>
              <input
                id={`${baseId}-fromName`}
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className={INPUT}
                aria-describedby={`${baseId}-fromName-hint`}
              />
            </Field>
            <Field
              id={`${baseId}-fromAddress`}
              label="From address"
              hint="Must be an address or domain this provider lets you send from."
            >
              <input
                id={`${baseId}-fromAddress`}
                type="email"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                className={INPUT}
                aria-describedby={`${baseId}-fromAddress-hint`}
                aria-invalid={errorFor("fromAddress") !== undefined}
              />
              {errorFor("fromAddress") !== undefined && (
                <p className="mt-1 text-xs text-error-700">{errorFor("fromAddress")}</p>
              )}
            </Field>
            <Field id={`${baseId}-replyTo`} label="Reply-to (optional)" hint="Where replies go. Leave blank to use the From address." className="sm:col-span-2">
              <input
                id={`${baseId}-replyTo`}
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className={INPUT}
                aria-describedby={`${baseId}-replyTo-hint`}
              />
            </Field>
          </div>
        </fieldset>

        {error !== null && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-500/10 px-3 py-2.5 text-sm text-error-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save details"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function SchemaField({
  id,
  field,
  stored,
  value,
  error,
  onChange,
}: {
  id: string;
  field: MailField;
  stored: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const hint =
    field.type === "password" && stored
      ? "Stored — leave blank to keep it."
      : (field.hint ?? undefined);
  const describedBy = hint !== undefined ? `${id}-hint` : undefined;

  return (
    <Field id={id} label={field.required ? field.label : `${field.label} (optional)`} hint={hint}>
      {field.type === "select" ? (
        <SearchableSelect
          id={id}
          value={value}
          onChange={onChange}
          placeholder="Choose…"
          clearable={!field.required}
          aria-describedby={describedBy}
          aria-invalid={error !== undefined}
          options={(field.options ?? []).map((o) => ({ value: optionValue(o), label: optionLabel(o) }))}
        />
      ) : field.type === "password" ? (
        <div className="relative">
          <input
            id={id}
            type={revealed ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cx(INPUT, "pr-11")}
            autoComplete="new-password"
            placeholder={stored ? "••••••••" : undefined}
            aria-describedby={describedBy}
            aria-invalid={error !== undefined}
          />
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? `Hide ${field.label}` : `Show ${field.label}`}
            aria-pressed={revealed}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            {revealed ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
      ) : (
        <input
          id={id}
          type={field.type === "email" ? "email" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
          aria-describedby={describedBy}
          aria-invalid={error !== undefined}
        />
      )}
      {error !== undefined && <p className="mt-1 text-xs text-error-700">{error}</p>}
    </Field>
  );
}

