"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Check,
  Hash,
  KeyRound,
  Loader2,
  ExternalLink,
  Lock,
  Mail,
  MessageCircle,
  Save,
  Send,
  Unplug,
} from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { inputClass } from "@/suite/lms/components/ui/ws";
import {
  ApiError,
  EMAIL_PROVIDER_LABEL,
  MAX_LIST_ADDRESSES,
  ZOHO_REGIONS,
  isEmailAddress,
  orgIntegrations as api,
  parseAddressList,
  type EmailIntegrationInput,
  type EmailProvider,
  type IntegrationProvider,
  type OrgIntegration,
  type TestResult,
  type ZohoAccount,
  type ZohoRegion,
} from "@/lib/api/integrations-client";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import AddressChips from "@/components/shared/AddressChips";

/**
 * Where project updates leave XwiftHQ: the organisation's own Slack app, its
 * own WhatsApp Business number, and its own mailbox (Gmail or Zoho Mail).
 *
 * **Theirs, not ours.** Each organisation connects its own accounts, messages
 * go out under their Slack app and are billed to their Meta account. The page
 * says so, because "who pays for this?" is the first question anybody asks
 * before pasting a token.
 *
 * **Three states, in order.** A token can be saved, then proved to work, then
 * switched on, and each card shows exactly how far along it is. "Saved" and
 * "works" are kept apart on purpose: a pasted token that Slack rejects must
 * never look connected.
 *
 * **A token is never shown again.** The API returns the last four characters,
 * which answers "is this the one I think it is" without being enough to use.
 * The box starts empty, and leaving it empty keeps the saved one.
 *
 * Turning a channel on here only makes it *available*. Nobody receives a Slack
 * DM or a WhatsApp message until they choose it on their own notification
 * settings, WhatsApp needs their explicit consent under Meta's rules.
 *
 * **One mailbox at a time.** Gmail and Zoho Mail both sign in with an app
 * password and only send. Only one of them sends project email; switching one
 * on switches the other off, and the board says which one it turned off
 * rather than leaving a switch to flip back silently.
 */
export default function IntegrationsBoard() {
  const [rows, setRows] = useState<OrgIntegration[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    api
      .list()
      .then((list) => {
        if (!alive) return;
        setRows(list);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(e instanceof ApiError ? e.message : "Could not load your integrations.");
      });
    return () => {
      alive = false;
    };
  }, [reloads]);

  const replace = useCallback((next: OrgIntegration) => {
    setRows((prev) => {
      const list = prev ?? [];
      return list.some((r) => r.provider === next.provider)
        ? list.map((r) => (r.provider === next.provider ? next : r))
        : [...list, next];
    });
  }, []);

  // Which mailbox the server switched off, and for which one, said once, here.
  const [handover, setHandover] = useState<{ on: EmailProvider; off: EmailProvider } | null>(null);
  const switchedOff = useCallback((on: IntegrationProvider, off: EmailProvider) => {
    setRows((prev) => (prev ?? []).map((r) => (r.provider === off ? { ...r, enabled: false } : r)));
    if (on === "gmail" || on === "zoho_mail") setHandover({ on, off });
  }, []);

  const header = (
    <PageHeader
      eyebrow="Institution"
      title="Integrations"
      subtitle="Send project updates to Slack, WhatsApp and email, through your organisation's own accounts."
    />
  );

  if (forbidden) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <Empty
            icon={Lock}
            hue="sun"
            title="Only admins and delivery leads can change integrations"
            hint="Ask one of them to connect Slack, WhatsApp or a mailbox. You can still choose where you are reached from your own notification settings."
          />
        </Card>
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="space-y-6">
        {header}
        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <p className="flex items-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            Loading integrations…
          </p>
        )}
      </div>
    );
  }

  const find = (p: IntegrationProvider) => rows.find((r) => r.provider === p) ?? blank(p);

  return (
    <div className="space-y-6">
      {header}
      {error && <Notice tone="error">{error}</Notice>}
      <SlackCard row={find("slack")} onChange={replace} onRemoved={reload} />
      <WhatsAppCard row={find("whatsapp")} onChange={replace} onRemoved={reload} />
      <EmailGroup gmail={find("gmail")} zoho={find("zoho_mail")} handover={handover} />
      <GmailCard
        row={find("gmail")}
        other={find("zoho_mail")}
        onChange={(r) => {
          if (r.enabled) setHandover(null);
          replace(r);
        }}
        onRemoved={reload}
        onSwitchedOff={switchedOff}
      />
      <ZohoMailCard
        row={find("zoho_mail")}
        other={find("gmail")}
        onChange={(r) => {
          if (r.enabled) setHandover(null);
          replace(r);
        }}
        onRemoved={reload}
        onSwitchedOff={switchedOff}
      />
      <p className="rounded-2xl bg-white/60 px-4 py-3 text-xs text-neutral-500 ring-1 ring-inset ring-neutral-200/70">
        Switching a channel on makes it available. Each person then chooses it for themselves under
        Notification settings. Nobody is messaged on Slack, WhatsApp or email without choosing to be.
      </p>
    </div>
  );
}

function blank(provider: IntegrationProvider): OrgIntegration {
  return {
    provider,
    connected: false,
    enabled: false,
    verifiedAt: null,
    lastError: null,
    lastUsedAt: null,
    settings: {},
    masked: null,
  };
}

/* ------------------------------------------------------------------ */
/*  Slack                                                              */
/* ------------------------------------------------------------------ */

function SlackCard({
  row,
  onChange,
  onRemoved,
}: {
  row: OrgIntegration;
  onChange: (r: OrgIntegration) => void;
  onRemoved: () => void;
}) {
  const [token, setToken] = useState("");
  const ctl = useProviderControls("slack", onChange, onRemoved);

  const verified = row.verifiedAt !== null;
  const tokenId = "slack-token";

  return (
    <Panel
      title="Slack"
      subtitle="Direct messages to each person, and team posts to a project's channel"
      icon={Hash}
      hue="grape"
      actions={<StateLadder row={row} />}
      bodyClassName="px-5 pb-5 pt-4"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {verified && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
              <BadgeCheck size={16} className="text-mint-600" aria-hidden />
              Connected to <span className="font-semibold">{row.settings.teamName ?? "your workspace"}</span>
              {row.settings.botUser && (
                <>
                  as <span className="font-semibold">@{row.settings.botUser.replace(/^@/, "")}</span>
                </>
              )}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (token.trim() === "") return;
              void ctl.save({ botToken: token.trim() }).then((ok) => ok && setToken(""));
            }}
            className="space-y-2"
          >
            <label htmlFor={tokenId} className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-700">
              Bot User OAuth Token
              {row.masked?.botToken && (
                <Chip hue="mint" icon={KeyRound}>
                  Saved · {row.masked.botToken}
                </Chip>
              )}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={tokenId}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={row.connected ? "Leave blank to keep the saved token" : "xoxb-…"}
                aria-describedby="slack-token-hint"
                className={cx(inputClass, "font-mono")}
              />
              <Button type="submit" icon={ctl.busy === "save" ? undefined : Save} disabled={ctl.busy !== null || token.trim() === ""} className="shrink-0 whitespace-nowrap">
                {ctl.busy === "save" && <Loader2 size={16} className="animate-spin" aria-hidden />}
                {ctl.busy === "save" ? "Checking…" : row.connected ? "Replace and verify" : "Save and verify"}
              </Button>
            </div>
            <p id="slack-token-hint" className="text-xs text-neutral-500">
              Starts with <span className="font-mono">xoxb-</span>. We check it with Slack before saving it.
            </p>
          </form>

          <EnableRow
            label="Send Slack messages"
            on={row.enabled}
            verified={verified}
            busy={ctl.busy === "enable"}
            onToggle={(v) => void ctl.save({ enabled: v }, "enable")}
          />

          <HealthAndActions row={row} ctl={ctl} testLabel="Send me a test DM" name="Slack" />
        </div>

        <Guide title="Set up the Slack app">
          <li>
            Go to <span className="font-mono text-neutral-800">api.slack.com/apps</span> and create an app
            from scratch in your workspace.
          </li>
          <li>
            Under <b>OAuth &amp; Permissions</b>, add these bot token scopes:
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {["chat:write", "users:read", "users:read.email", "im:write"].map((s) => (
                <code key={s} className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] text-neutral-800 ring-1 ring-neutral-200">
                  {s}
                </code>
              ))}
            </span>
          </li>
          <li>Install the app to your workspace.</li>
          <li>
            Copy the <b>Bot User OAuth Token</b> (it starts with <span className="font-mono">xoxb-</span>) and
            paste it here.
          </li>
          <li>
            For team posts, invite the app to each project&apos;s channel with{" "}
            <span className="font-mono text-neutral-800">/invite @your-app</span>.
          </li>
        </Guide>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  WhatsApp                                                           */
/* ------------------------------------------------------------------ */

function WhatsAppCard({
  row,
  onChange,
  onRemoved,
}: {
  row: OrgIntegration;
  onChange: (r: OrgIntegration) => void;
  onRemoved: () => void;
}) {
  const [token, setToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(row.settings.phoneNumberId ?? "");
  const [templateName, setTemplateName] = useState(row.settings.templateName ?? "");
  const [templateLanguage, setTemplateLanguage] = useState(row.settings.templateLanguage ?? "en");
  const [missing, setMissing] = useState<string | null>(null);
  const ctl = useProviderControls("whatsapp", onChange, onRemoved);

  const verified = row.verifiedAt !== null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!row.connected && token.trim() === "") {
      setMissing("Paste the access token.");
      return;
    }
    if (phoneNumberId.trim() === "" || templateName.trim() === "") {
      setMissing("The phone number ID and the template name are both needed.");
      return;
    }
    setMissing(null);
    void ctl
      .save({
        ...(token.trim() !== "" ? { accessToken: token.trim() } : {}),
        phoneNumberId: phoneNumberId.trim(),
        templateName: templateName.trim(),
        templateLanguage: templateLanguage.trim() || "en",
      })
      .then((ok) => ok && setToken(""));
  };

  return (
    <Panel
      title="WhatsApp"
      subtitle="Messages to the people who opt in, from your WhatsApp Business number"
      icon={MessageCircle}
      hue="mint"
      actions={<StateLadder row={row} />}
      bodyClassName="px-5 pb-5 pt-4"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {verified && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
              <BadgeCheck size={16} className="text-mint-600" aria-hidden />
              Sending from{" "}
              <span className="font-semibold tabular-nums">{row.settings.displayNumber ?? "your number"}</span>
              {row.settings.verifiedName && <span className="text-neutral-500">({row.settings.verifiedName})</span>}
            </p>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="wa-token" className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-700">
                Access token
                {row.masked?.accessToken && (
                  <Chip hue="mint" icon={KeyRound}>
                    Saved · {row.masked.accessToken}
                  </Chip>
                )}
              </label>
              <input
                id="wa-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={row.connected ? "Leave blank to keep the saved token" : "Paste a permanent access token"}
                className={cx(inputClass, "font-mono")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="wa-phone-id" label="Phone number ID" hint="Not the phone number itself: the ID Meta shows under API Setup.">
                <input
                  id="wa-phone-id"
                  inputMode="numeric"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  aria-describedby="wa-phone-id-hint"
                  className={cx(inputClass, "tabular-nums")}
                />
              </Field>
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
                <Field id="wa-template" label="Template name" hint="Exactly as approved in Meta.">
                  <input
                    id="wa-template"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="xwifthq_update"
                    aria-describedby="wa-template-hint"
                    className={cx(inputClass, "font-mono")}
                  />
                </Field>
                <Field id="wa-lang" label="Language" hint="e.g. en, en_US">
                  <input
                    id="wa-lang"
                    value={templateLanguage}
                    onChange={(e) => setTemplateLanguage(e.target.value)}
                    aria-describedby="wa-lang-hint"
                    className={cx(inputClass, "font-mono")}
                  />
                </Field>
              </div>
            </div>

            {missing && (
              <p role="alert" className="flex items-center gap-2 text-sm text-error-700">
                <AlertCircle size={15} aria-hidden />
                {missing}
              </p>
            )}

            <Button type="submit" icon={ctl.busy === "save" ? undefined : Save} disabled={ctl.busy !== null}>
              {ctl.busy === "save" && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {ctl.busy === "save" ? "Checking…" : "Save and verify"}
            </Button>
          </form>

          <EnableRow
            label="Send WhatsApp messages"
            on={row.enabled}
            verified={verified}
            busy={ctl.busy === "enable"}
            /*
              The API validates the number ID and template on every WhatsApp
              save, so the switch sends the saved ones along with it.
            */
            onToggle={(v) =>
              void ctl.save(
                {
                  enabled: v,
                  phoneNumberId: row.settings.phoneNumberId ?? "",
                  templateName: row.settings.templateName ?? "",
                  templateLanguage: row.settings.templateLanguage ?? "en",
                },
                "enable",
              )
            }
          />

          <HealthAndActions
            row={row}
            ctl={ctl}
            testLabel="Send me a test message"
            name="WhatsApp"
            testHint="Goes to the number you opted in with under your own notification settings."
          />
        </div>

        <Guide
          title="Set up your WhatsApp number"
          footer={
            <>
              <p className="rounded-lg bg-sun-50 px-3 py-2 text-sun-700">
                WhatsApp only allows a free-form message within 24 hours of the person last messaging your
                number, so outside that window XwiftHQ sends your approved template instead.
              </p>
              <p className="text-neutral-500">Messages are billed to your Meta account.</p>
            </>
          }
        >
          <li>
            In <span className="font-mono text-neutral-800">developers.facebook.com</span>, create a Business app
            with the WhatsApp product and add your business phone number.
          </li>
          <li>
            Copy the <b>Phone number ID</b> from WhatsApp › API Setup.
          </li>
          <li>
            In Business Settings, create a system user with the{" "}
            <span className="font-mono">whatsapp_business_messaging</span> permission and generate a permanent
            access token for it.
          </li>
          <li>
            Create a message template in the <b>Utility</b> category with the body{" "}
            <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] text-neutral-800 ring-1 ring-neutral-200">
              XwiftHQ update: {"{{1}}"}
            </code>{" "}
            and wait for Meta to approve it. Enter its name and language here exactly as Meta shows them.
          </li>
        </Guide>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Email: Gmail and Zoho Mail                                         */
/* ------------------------------------------------------------------ */

/**
 * The line above the two mailbox cards that answers "which one is sending?".
 *
 * Two slots, one per mailbox, with the sending one filled and the other
 * hatched, the same "not yet" texture as the state ladder, so the rule that
 * only one sends reads from the shape before anyone reads the words.
 */
function EmailGroup({
  gmail,
  zoho,
  handover,
}: {
  gmail: OrgIntegration;
  zoho: OrgIntegration;
  handover: { on: EmailProvider; off: EmailProvider } | null;
}) {
  const sending = gmail.enabled ? gmail : zoho.enabled ? zoho : null;
  const sendingName = sending ? EMAIL_PROVIDER_LABEL[sending.provider as EmailProvider] : null;

  return (
    <div className="pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-3 text-base font-bold tracking-tight text-neutral-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-md shadow-sky-500/25" aria-hidden>
              <Mail size={16} />
            </span>
            Project email
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
            Send project updates from your own Gmail or Zoho Mail mailbox, signed in with an app password. XwiftHQ
            only sends from it and never reads your mail. One mailbox sends at a time: switching one on switches the
            other off.
          </p>
        </div>

        <ul aria-label="Mailboxes" className="flex items-center gap-1">
          {[gmail, zoho].map((row) => (
            <li
              key={row.provider}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
                row.enabled ? "bg-sky-50 text-sky-700 ring-1 ring-sky-100" : "ws-hatch text-neutral-500",
              )}
            >
              {row.enabled && <Send size={12} aria-hidden />}
              {EMAIL_PROVIDER_LABEL[row.provider as EmailProvider]}
              <span className="sr-only">{row.enabled ? " (sending)" : " (off)"}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-sm text-neutral-700">
        {sending ? (
          <>
            Sending project email from <span className="font-semibold">{sendingName}</span>
            {sending.settings.address && (
              <>
                {" "}
                as <span className="font-semibold">{sending.settings.address}</span>
              </>
            )}
            .
          </>
        ) : (
          <span className="text-neutral-500">No mailbox is sending project email yet.</span>
        )}
      </p>

      {handover && (
        <div className="mt-3">
          <Notice tone="success">
            {EMAIL_PROVIDER_LABEL[handover.off]} was switched off. Project email now goes out from{" "}
            {EMAIL_PROVIDER_LABEL[handover.on]}.
          </Notice>
        </div>
      )}
    </div>
  );
}

interface EmailCardProps {
  row: OrgIntegration;
  /** The other mailbox, so this card can say what switching on will turn off. */
  other: OrgIntegration;
  onChange: (r: OrgIntegration) => void;
  onRemoved: () => void;
  onSwitchedOff: (on: IntegrationProvider, off: EmailProvider) => void;
}

function GmailCard(props: EmailCardProps) {
  return (
    <EmailCard
      {...props}
      provider="gmail"
      subtitle="Project updates from your Google mailbox, signed in with an app password"
      guide={() => (
        <Guide
          title="Create a Gmail app password"
          footer={
            <p className="rounded-lg bg-sun-50 px-3 py-2 text-sun-700">
              On Google Workspace, an admin may need to allow 2-Step Verification (and so app passwords) for your
              account before the App passwords page appears.
            </p>
          }
        >
          <li>Sign in to the Google account you want to send from. A shared mailbox such as projects@ works best.</li>
          <li>
            Turn on{" "}
            <GuideLink href="https://myaccount.google.com/signinoptions/two-step-verification">
              2-Step Verification
            </GuideLink>
            . Google only offers app passwords once it is on.
          </li>
          <li>
            Open <GuideLink href="https://myaccount.google.com/apppasswords">App passwords</GuideLink>, name it
            &ldquo;XwiftHQ&rdquo; and create it.
          </li>
          <li>Copy the 16-letter password Google shows and paste it here. The spaces don&apos;t matter.</li>
        </Guide>
      )}
    />
  );
}

function ZohoMailCard(props: EmailCardProps) {
  return (
    <EmailCard
      {...props}
      provider="zoho_mail"
      subtitle="Project updates from your Zoho mailbox, signed in with an app password"
      guide={(region) => (
        <Guide
          title="Create a Zoho app password"
          footer={
            <p className="text-neutral-500">
              <b className="text-neutral-700">Which data centre?</b> Look at the address you open Zoho Mail at:{" "}
              <span className="font-mono">mail.zoho.eu</span> means zoho.eu,{" "}
              <span className="font-mono">mail.zoho.in</span> means zoho.in, and so on. If it ends in{" "}
              <span className="font-mono">zoho.com</span>, pick zoho.com.
            </p>
          }
        >
          <li>Sign in to Zoho Mail with the mailbox you want to send from.</li>
          <li>
            In Zoho Mail, open <b>Settings › Mail Accounts</b> and check that <b>IMAP access</b> is on. Zoho needs it
            on to accept mail sent from other apps.
          </li>
          <li>
            Open{" "}
            <GuideLink href={`https://accounts.zoho.${region}/home#security/app_password`}>
              Security › App Passwords
            </GuideLink>{" "}
            and generate a new password named &ldquo;XwiftHQ&rdquo;.
          </li>
          <li>Copy it and paste it here, then pick the data centre and account type that match your mailbox.</li>
        </Guide>
      )}
    />
  );
}

/**
 * One mailbox. Gmail and Zoho ask for the same things, the address, an app
 * password, a display name and an optional default list, and Zoho adds where
 * the account lives and whether it is on the organisation's own domain, which
 * decide the server XwiftHQ signs in to.
 */
function EmailCard({
  provider,
  row,
  other,
  onChange,
  onRemoved,
  onSwitchedOff,
  subtitle,
  guide,
}: EmailCardProps & {
  provider: EmailProvider;
  subtitle: string;
  /** Given the chosen region, so Zoho's guide links to the right accounts site. */
  guide: (region: ZohoRegion) => React.ReactNode;
}) {
  const zoho = provider === "zoho_mail";
  const name = EMAIL_PROVIDER_LABEL[provider];
  const otherName = EMAIL_PROVIDER_LABEL[provider === "gmail" ? "zoho_mail" : "gmail"];
  const ids = `mail-${provider}`;

  const [address, setAddress] = useState(row.settings.address ?? "");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState(row.settings.fromName ?? "");
  const [list, setList] = useState(parseAddressList(row.settings.defaultList).join("\n"));
  const [region, setRegion] = useState<ZohoRegion>(row.settings.region ?? "com");
  const [account, setAccount] = useState<ZohoAccount>(row.settings.account ?? "organisation");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const ctl = useProviderControls(provider, onChange, onRemoved, onSwitchedOff);

  const verified = row.verifiedAt !== null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const addresses = parseAddressList(list);
    const bad = addresses.find((a) => !isEmailAddress(a));
    const next: Record<string, string> = {};

    if (!isEmailAddress(address.trim())) next.address = "Enter the mailbox's full address, like projects@yourcompany.com.";
    if (!row.connected && password.trim() === "") next.appPassword = `Paste the app password you created in ${name}.`;
    if (bad) next.defaultList = `“${bad}” is not an email address.`;
    else if (addresses.length > MAX_LIST_ADDRESSES) next.defaultList = `A list can hold up to ${MAX_LIST_ADDRESSES} addresses.`;
    setProblems(next);
    if (Object.keys(next).length > 0) return;

    const body: EmailIntegrationInput = {
      address: address.trim(),
      // App passwords never contain spaces; Google shows them in groups of four.
      ...(password.trim() !== "" ? { appPassword: password.replace(/\s+/g, "") } : {}),
      fromName: fromName.trim() === "" ? null : fromName.trim(),
      defaultList: addresses.length === 0 ? null : addresses.join(", "),
      ...(zoho ? { region, account } : {}),
    };
    void ctl.save({ ...body }).then((ok) => ok && setPassword(""));
  };

  // The API wants the address on every save, so the switch re-sends what is saved.
  const toggle = (v: boolean) => {
    const body: EmailIntegrationInput = {
      enabled: v,
      address: row.settings.address ?? address.trim(),
      fromName: row.settings.fromName ?? null,
      defaultList: row.settings.defaultList ?? null,
      ...(zoho ? { region: row.settings.region ?? region, account: row.settings.account ?? account } : {}),
    };
    void ctl.save({ ...body }, "enable");
  };

  return (
    <Panel
      title={name}
      subtitle={subtitle}
      icon={Mail}
      hue={zoho ? "coral" : "rose"}
      actions={<StateLadder row={row} />}
      bodyClassName="px-5 pb-5 pt-4"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {verified && row.settings.address && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
              <BadgeCheck size={16} className="text-mint-600" aria-hidden />
              Sends as{" "}
              <span className="font-semibold">
                {row.settings.fromName ? `${row.settings.fromName} <${row.settings.address}>` : row.settings.address}
              </span>
            </p>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${ids}-address`} label="Mailbox address">
                <input
                  id={`${ids}-address`}
                  type="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="projects@yourcompany.com"
                  aria-invalid={problems.address !== undefined}
                  aria-describedby={problems.address ? `${ids}-address-error` : undefined}
                  className={inputClass}
                />
                <FieldProblem id={`${ids}-address-error`} message={problems.address} />
              </Field>

              <div>
                <label
                  htmlFor={`${ids}-password`}
                  className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-700"
                >
                  App password
                  {row.masked?.appPassword && (
                    <Chip hue="mint" icon={KeyRound}>
                      Saved · {row.masked.appPassword}
                    </Chip>
                  )}
                </label>
                <input
                  id={`${ids}-password`}
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={row.connected ? "Leave blank to keep the saved one" : "Not your sign-in password"}
                  aria-invalid={problems.appPassword !== undefined}
                  aria-describedby={problems.appPassword ? `${ids}-password-error` : `${ids}-password-hint`}
                  className={cx(inputClass, "font-mono")}
                />
                {problems.appPassword ? (
                  <FieldProblem id={`${ids}-password-error`} message={problems.appPassword} />
                ) : (
                  <p id={`${ids}-password-hint`} className="mt-1.5 text-xs text-neutral-500">
                    A password made for XwiftHQ alone. We sign in to {name} with it before saving.
                  </p>
                )}
              </div>
            </div>

            {zoho && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`${ids}-region`} label="Data centre" hint="The domain in your Zoho address bar.">
                  <SearchableSelect
                    id={`${ids}-region`}
                    value={region}
                    onChange={(v) => setRegion(v as ZohoRegion)}
                    options={ZOHO_REGIONS.map((r) => ({ value: r.value, label: r.label, hint: r.hint }))}
                    aria-describedby={`${ids}-region-hint`}
                    searchPlaceholder="Search data centres"
                  />
                </Field>
                <div>
                  <p className="mb-1.5 block text-sm font-medium text-neutral-700">Account type</p>
                  <Segmented<ZohoAccount>
                    label="Account type"
                    value={account}
                    onChange={setAccount}
                    options={[
                      { key: "organisation", label: "Your own domain" },
                      { key: "personal", label: "Personal" },
                    ]}
                  />
                  <p className="mt-1.5 text-xs text-neutral-500">
                    {account === "organisation"
                      ? "An address on your organisation's own domain, hosted by Zoho Mail."
                      : "An address ending in @zohomail.com or @zoho.com."}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${ids}-from`} label="From name" hint="What people see in their inbox. Optional.">
                <input
                  id={`${ids}-from`}
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  maxLength={80}
                  placeholder="Acme Projects"
                  aria-describedby={`${ids}-from-hint`}
                  className={inputClass}
                />
              </Field>
              <div>
                <label htmlFor={`${ids}-list`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Default team list <span className="font-normal text-neutral-500">(optional)</span>
                </label>
                <textarea
                  id={`${ids}-list`}
                  value={list}
                  onChange={(e) => setList(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  placeholder={"delivery@yourcompany.com\nleads@yourcompany.com"}
                  aria-invalid={problems.defaultList !== undefined}
                  aria-describedby={problems.defaultList ? `${ids}-list-error` : `${ids}-list-hint`}
                  className={cx(inputClass, "h-auto min-h-[5.5rem] py-2.5 font-mono text-[13px]")}
                />
                {problems.defaultList ? (
                  <FieldProblem id={`${ids}-list-error`} message={problems.defaultList} />
                ) : (
                  <p id={`${ids}-list-hint`} className="mt-1.5 text-xs text-neutral-500">
                    Team updates go here for projects without their own list. One per line, or separated by commas.
                  </p>
                )}
                <AddressChips value={list} />
              </div>
            </div>

            <Button type="submit" icon={ctl.busy === "save" ? undefined : Save} disabled={ctl.busy !== null}>
              {ctl.busy === "save" && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {ctl.busy === "save" ? "Checking…" : "Save and verify"}
            </Button>
          </form>

          <EnableRow
            label={`Send project email from ${name}`}
            on={row.enabled}
            verified={verified}
            busy={ctl.busy === "enable"}
            onToggle={toggle}
            blockedHint="Save an app password that verifies before switching this on."
            onHint={`On. Project email goes out from this mailbox, and ${otherName} stays off.`}
            offHint={
              other.enabled
                ? `Off. ${otherName} is sending project email now. Switching this on turns ${otherName} off.`
                : "Off. No project email is sent from this mailbox."
            }
          />

          <HealthAndActions
            row={row}
            ctl={ctl}
            testLabel="Send me a test email"
            name={name}
            testHint="Goes to the address you sign in to XwiftHQ with."
            lastUsedLabel="Last email sent"
          />
        </div>

        {guide(region)}
      </div>
    </Panel>
  );
}

function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 font-semibold text-primary-700 underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      {children}
      <ExternalLink size={11} aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function FieldProblem({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-error-700">
      <AlertCircle size={13} className="shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared pieces                                                      */
/* ------------------------------------------------------------------ */

type Busy = "save" | "enable" | "test" | "disconnect" | null;

interface ProviderControls {
  busy: Busy;
  error: string | null;
  test: TestResult | null;
  /** What the provider said when a save re-checked the credentials. */
  verification: TestResult | null;
  save: (body: Record<string, unknown>, kind?: "save" | "enable") => Promise<boolean>;
  runTest: () => Promise<void>;
  /** Asks first, naming the provider; resolves without doing anything if declined. */
  disconnect: (name: string) => Promise<void>;
}

function useProviderControls(
  provider: IntegrationProvider,
  onChange: (r: OrgIntegration) => void,
  onRemoved: () => void,
  /** Called when switching this one on switched the other mailbox off. */
  onSwitchedOff?: (on: IntegrationProvider, off: EmailProvider) => void,
): ProviderControls {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [verification, setVerification] = useState<TestResult | null>(null);
  const confirm = useConfirm();

  const save = async (body: Record<string, unknown>, kind: "save" | "enable" = "save") => {
    setBusy(kind);
    setError(null);
    setTest(null);
    setVerification(null);
    try {
      const saved = await api.save(provider, body);
      onChange(saved.integration);
      if (saved.disabled && saved.disabled !== provider) onSwitchedOff?.(provider, saved.disabled);
      setVerification(saved.verification);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy("test");
    setError(null);
    setTest(null);
    try {
      setTest(await api.test(provider));
    } catch (e) {
      setTest({ ok: false, detail: e instanceof ApiError ? e.message : "The test could not be sent." });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (name: string) => {
    const ok = await confirm({
      title: `Disconnect ${name}?`,
      body: `Nobody will be messaged on ${name}. The saved credentials are erased for good, not kept in the recycle bin, so reconnecting means entering them again.`,
      confirmLabel: "Disconnect",
    });
    if (!ok) return;

    setBusy("disconnect");
    setError(null);
    try {
      await api.disconnect(provider);
      setTest(null);
      setVerification(null);
      onRemoved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That could not be disconnected.");
    } finally {
      setBusy(null);
    }
  };

  return { busy, error, test, verification, save, runTest, disconnect };
}

/**
 * How far along a connection is: saved, proved, switched on. Steps not yet
 * reached are hatched, the workspace's "not yet", so the ladder reads at a
 * glance without relying on colour: each step also carries its word and a tick.
 */
function StateLadder({ row }: { row: OrgIntegration }) {
  const steps = [
    { key: "saved", label: "Saved", done: row.connected },
    { key: "verified", label: "Verified", done: row.verifiedAt !== null },
    { key: "on", label: "On", done: row.enabled },
  ];
  const reached = steps.filter((s) => s.done).length;
  const summary = row.enabled ? "On" : row.verifiedAt ? "Verified, switched off" : row.connected ? "Saved, not verified" : "Not connected";

  return (
    <>
      <span className="sm:hidden">
        <Chip hue={row.enabled ? "mint" : row.connected ? "sun" : "slate"}>{summary}</Chip>
      </span>
    <ol aria-label={`Status: ${summary}`} className="hidden items-center gap-1 sm:flex">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1">
          <span
            className={cx(
              "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold",
              s.done ? "bg-mint-50 text-mint-700" : "ws-hatch text-neutral-500",
            )}
          >
            {s.done && <Check size={12} aria-hidden />}
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className={cx("h-px w-3", i < reached - 1 ? "bg-mint-500" : "bg-neutral-200")} aria-hidden />
          )}
        </li>
      ))}
    </ol>
    </>
  );
}

function EnableRow({
  label,
  on,
  verified,
  busy,
  onToggle,
  blockedHint = "Save a token that verifies before switching this on.",
  onHint = "On. People who choose this channel receive their project updates here.",
  offHint = "Off. Nothing is sent, and people's choices are kept for when it is back on.",
}: {
  label: string;
  on: boolean;
  verified: boolean;
  busy: boolean;
  onToggle: (v: boolean) => void;
  blockedHint?: string;
  onHint?: string;
  offHint?: string;
}) {
  // Switching off is always allowed; switching on needs a verified connection.
  const blocked = !on && !verified;

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-primary-50/40 px-4 py-3 ring-1 ring-inset ring-primary-100/70">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {blocked ? blockedHint : on ? onHint : offHint}
        </p>
      </div>
      <Switch checked={on} disabled={blocked || busy} onChange={onToggle} label={label} />
    </div>
  );
}

function HealthAndActions({
  row,
  ctl,
  testLabel,
  testHint,
  name,
  lastUsedLabel = "Last message sent",
}: {
  row: OrgIntegration;
  ctl: ProviderControls;
  testLabel: string;
  testHint?: string;
  name: string;
  lastUsedLabel?: string;
}) {
  const verified = row.verifiedAt !== null;

  return (
    <div className="space-y-3">
      {ctl.error && <Notice tone="error">{ctl.error}</Notice>}

      {ctl.verification && (
        <Notice tone={ctl.verification.ok ? "success" : "error"}>
          {ctl.verification.ok ? "" : "Saved, but it does not work yet: "}
          {ctl.verification.detail}
        </Notice>
      )}

      {row.lastError && !(ctl.verification && !ctl.verification.ok) && (
        <Notice tone="error">
          <span className="font-semibold">Last problem:</span> {row.lastError}
        </Notice>
      )}

      {ctl.test && (
        <Notice tone={ctl.test.ok ? "success" : "error"}>
          {ctl.test.ok ? "Test sent. " : "Test failed. "}
          {ctl.test.detail}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button icon={ctl.busy === "test" ? undefined : Send} disabled={!verified || ctl.busy !== null} onClick={() => void ctl.runTest()}>
          {ctl.busy === "test" && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {ctl.busy === "test" ? "Sending…" : testLabel}
        </Button>

        {row.connected && (
          <Button
            variant="ghost"
            icon={Unplug}
            className="!text-error-700"
            disabled={ctl.busy !== null}
            onClick={() => void ctl.disconnect(name)}
          >
            Disconnect
          </Button>
        )}
      </div>

      {testHint && verified && <p className="text-xs text-neutral-500">{testHint}</p>}

      {row.lastUsedAt && (
        <p className="text-xs text-neutral-500">{lastUsedLabel} {new Date(row.lastUsedAt).toLocaleString()}.</p>
      )}
    </div>
  );
}

function Guide({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <aside className="rounded-2xl bg-primary-50/40 p-4 ring-1 ring-inset ring-primary-100/70">
      <h4 className="text-[13px] font-semibold text-neutral-900">{title}</h4>
      <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-xs leading-relaxed text-neutral-600 marker:font-semibold marker:text-neutral-500">
        {children}
      </ol>
      {footer && <div className="mt-3 space-y-2 text-xs leading-relaxed">{footer}</div>}
    </aside>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-neutral-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : Check;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm",
        tone === "error" ? "border-error-500/20 bg-error-500/5 text-error-700" : "border-mint-100 bg-mint-50 font-medium text-mint-700",
      )}
    >
      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

export function Switch({
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
        className={cx(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
