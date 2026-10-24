"use client";

import { useEffect, useId, useState } from "react";
import { Hash, Loader2, Mail, MessageCircle, Plug, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { Button, CalloutStrip, Card, Chip, cx } from "@/components/workspace/kit";
import type { Project } from "@/lib/api/projects-client";
import {
  ApiError,
  PROJECT_CHANNEL_EVENTS,
  projectChannels as api,
  type ProjectChannels as Channels,
} from "@/lib/api/project-channels-client";
import { EMAIL_PROVIDER_LABEL, parseAddressList } from "@/lib/api/integrations-client";
import AddressChips from "@/components/shared/AddressChips";
import { normaliseSlackChannel } from "./ProjectSettingsDialog";
import {
  CheckRow,
  FieldError,
  Notice,
  SectionHeading,
  Skeleton,
  hintCls,
  inputCls,
  invalidCls,
  labelCls,
  textareaCls,
} from "./ui/pkit";

/**
 * Where this project's updates are posted.
 *
 * Personal notifications, "you were assigned this story", always reach the
 * person themselves, in the app and by email. This panel is about the *team*
 * post: the line in a Slack channel, a WhatsApp group or a team mailing list
 * that tells everybody on the project something happened. One set of events
 * decides what is posted, to all three.
 *
 * A project can have its own channel, group and list; left blank, it falls
 * back to the organisation's defaults from Integrations, and the panel names
 * those defaults when the API reports them, so "blank" never reads as "nowhere".
 *
 * **Email needs a mailbox.** Until the organisation switches on Gmail or Zoho
 * Mail the list is shown but locked, with who can connect one and where, and
 * a locked list is never sent, so saving here cannot wipe one kept from before.
 */
export default function ProjectChannels({ project }: { project: Project }) {
  const slackId = useId();
  const whatsappId = useId();
  const emailId = useId();
  const [loaded, setLoaded] = useState<Channels | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const [slack, setSlack] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [emailList, setEmailList] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get(project.slug)
      .then((c) => {
        if (!alive) return;
        setLoaded(c);
        setSlack(c.slackChannel ?? "");
        setWhatsapp(c.whatsappGroup ?? "");
        setEmailList(parseAddressList(c.emailList).join("\n"));
        setEvents(c.events);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(e instanceof ApiError ? e.message : "Channel settings didn't load.");
      });
    return () => {
      alive = false;
    };
  }, [project.slug, reloads]);

  if (loaded === null) {
    return loadError !== null ? (
      <Notice
        title="Channel settings didn't load"
        action={
          <Button size="sm" icon={RotateCcw} onClick={() => setReloads((n) => n + 1)}>
            Try again
          </Button>
        }
      >
        {loadError}
      </Notice>
    ) : (
      <div className="space-y-4" aria-busy="true" aria-label="Loading channel settings">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const emailConnected = loaded.emailConnected === true;
  const emailProvider = loaded.emailProvider ?? null;

  const toggle = (key: string, on: boolean) => {
    setSaved(false);
    setEvents((prev) => (on ? [...prev.filter((k) => k !== key), key] : prev.filter((k) => k !== key)));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);
    const addresses = parseAddressList(emailList);
    try {
      const next = await api.save(project.slug, {
        slackChannel: normaliseSlackChannel(slack),
        whatsappGroup: whatsapp.trim() === "" ? null : whatsapp.trim(),
        // Only sent while a mailbox is on; a locked list is left as it was.
        ...(emailConnected ? { emailList: addresses.length === 0 ? null : addresses.join(", ") } : {}),
        events,
      });
      setLoaded(next);
      setSlack(next.slackChannel ?? "");
      setWhatsapp(next.whatsappGroup ?? "");
      setEmailList(parseAddressList(next.emailList).join("\n"));
      setEvents(next.events);
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.errors ?? {});
      } else {
        setError("The channel settings weren't saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  const defaults = loaded.defaults ?? null;
  const defaultList = parseAddressList(defaults?.emailList);
  const fallback = (value: string | null | undefined, what: string) =>
    value ? `Left blank, updates go to your organisation's default ${what}, ${value}.` : `Left blank, updates go to your organisation's default ${what}.`;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <SectionHeading
        title="Notifications"
        hint="Where this project's team updates are posted. Each person is still notified directly, in the app and by email."
      />

      <Card className="p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor={slackId} className={cx(labelCls, "flex items-center gap-1.5")}>
              <Hash size={14} className="text-grape-600" aria-hidden />
              Slack channel
            </label>
            <input
              id={slackId}
              value={slack}
              onChange={(e) => {
                setSlack(e.target.value);
                setSaved(false);
              }}
              maxLength={96}
              placeholder="#hrm-delivery"
              spellCheck={false}
              autoComplete="off"
              aria-describedby={`${slackId}-hint`}
              aria-invalid={fieldErrors.slackChannel !== undefined}
              className={cx(inputCls, "font-mono")}
            />
            <span id={`${slackId}-hint`} className={hintCls}>
              {fallback(defaults?.slackChannel, "channel")} Invite your organisation&apos;s Slack app to the channel first.
            </span>
            <FieldError message={fieldErrors.slackChannel?.[0]} />
          </div>

          <div>
            <label htmlFor={whatsappId} className={cx(labelCls, "flex items-center gap-1.5")}>
              <MessageCircle size={14} className="text-mint-600" aria-hidden />
              WhatsApp group
            </label>
            <input
              id={whatsappId}
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.value);
                setSaved(false);
              }}
              maxLength={120}
              placeholder="Group id"
              spellCheck={false}
              autoComplete="off"
              aria-describedby={`${whatsappId}-hint`}
              aria-invalid={fieldErrors.whatsappGroup !== undefined}
              className={cx(inputCls, "font-mono")}
            />
            <span id={`${whatsappId}-hint`} className={hintCls}>
              {fallback(defaults?.whatsappGroup, "group")}
            </span>
            <FieldError message={fieldErrors.whatsappGroup?.[0]} />
          </div>

          <div className="md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={emailId} className={cx(labelCls, "flex items-center gap-1.5")}>
                <Mail size={14} className="text-sky-600" aria-hidden />
                Team email
              </label>
              {emailConnected && emailProvider && (
                <Chip hue="sky" dot className="mb-1.5">
                  Sent from {EMAIL_PROVIDER_LABEL[emailProvider]}
                </Chip>
              )}
            </div>
            <textarea
              id={emailId}
              value={emailList}
              onChange={(e) => {
                setEmailList(e.target.value);
                setSaved(false);
              }}
              disabled={!emailConnected}
              rows={3}
              placeholder={defaultList.length > 0 ? defaultList.join("\n") : "team@yourcompany.com\nclient-pm@example.com"}
              spellCheck={false}
              autoComplete="off"
              aria-describedby={`${emailId}-hint`}
              aria-invalid={fieldErrors.emailList !== undefined}
              className={cx(
                textareaCls,
                "font-mono text-[13px] disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
                fieldErrors.emailList !== undefined && invalidCls,
              )}
            />
            <span id={`${emailId}-hint`} className={hintCls}>
              {emailConnected ? (
                <>
                  Up to ten addresses, one per line or separated by commas.{" "}
                  {defaultList.length > 0
                    ? `Left blank, updates go to your organisation's default list, ${defaultList.join(", ")}.`
                    : "Left blank, updates go to your organisation's default list, if it has one."}
                </>
              ) : (
                <>
                  Email is off because your organisation hasn&apos;t switched on a mailbox. An admin or delivery lead
                  can connect Gmail or Zoho Mail on{" "}
                  <Link href="/suite/projects/integrations" className="font-semibold text-primary-700 hover:underline">
                    Integrations
                  </Link>
                  .
                </>
              )}
            </span>
            <FieldError message={fieldErrors.emailList?.[0]} />
            {emailConnected && <AddressChips value={emailList} />}
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="text-[13px] font-semibold text-neutral-700">
            Post to the channel, group and team email when…
          </legend>
          <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
            {PROJECT_CHANNEL_EVENTS.map((e) => (
              <CheckRow
                key={e.key}
                checked={events.includes(e.key)}
                onChange={(on) => toggle(e.key, on)}
                title={e.label}
                hint={e.hint}
              />
            ))}
          </div>
        </fieldset>

        <CalloutStrip icon={Plug} hue="sky" title="Connect the services first" className="mt-5">
          Slack, WhatsApp and a mailbox must be connected on{" "}
          {/*
            The Projects copy of the board, not /suite/org/integrations: the
            org console is admin-only, and a project or delivery lead reading
            this footer could not open it.
          */}
          <Link href="/suite/projects/integrations" className="font-semibold text-primary-700 hover:underline">
            Integrations
          </Link>{" "}
          for anything to be posted.
        </CalloutStrip>
      </Card>

      {error !== null && <Notice>{error}</Notice>}
      {saved && <Notice tone="success">Saved. New updates will be posted here.</Notice>}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" icon={saving ? Loader2 : Save} disabled={saving}>
          {saving ? "Saving…" : "Save channels"}
        </Button>
      </div>
    </form>
  );
}
