"use client";

import { useEffect, useId, useState } from "react";
import { AlertCircle, Bell, Check, Hash, Loader2, Mail, MessageCircle, Send } from "lucide-react";
import { SectionCard } from "@/components/dashboard/ui";
import { Button, Chip, cx } from "@/components/workspace/kit";
import {
  ApiError,
  normaliseE164,
  notificationChannels as api,
  type MyNotificationChannels,
  type MyNotificationChannelsInput,
  type ReachChannel,
  type TestResult,
} from "@/lib/api/integrations-client";

/**
 * "Where to reach me": the channels a person's notifications travel on.
 *
 * In XwiftHQ is always on — it is the record. Slack, WhatsApp and email are
 * extra copies, each the person's own choice, and each offered only once their
 * organisation has connected it: a switch for a channel that cannot send is a
 * promise the product cannot keep.
 *
 * **WhatsApp asks first.** Meta requires the recipient's opt-in, so turning it
 * on is a small form — the number (prefilled from their own HR record when
 * there is one) and a consent box in plain words — never a bare switch.
 *
 * **Slack says who it found.** The match is by work email; when it fails the
 * row says why ("not in that workspace") rather than showing a switch that is
 * on and silently reaches nobody.
 *
 * **Email goes to the sign-in address.** The organisation's mailbox sends it,
 * so the row names that address and nothing is typed. Until a mailbox is on,
 * the switch is shown locked with the reason, not hidden.
 *
 * Renders nothing when no channel is available, or when this deployment
 * has no channel endpoint at all — the switches above are still the whole story.
 */
export default function ReachChannels() {
  const [data, setData] = useState<MyNotificationChannels | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [test, setTest] = useState<{ channel: ReachChannel; result: TestResult } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        // Absent or refused: say nothing rather than render a broken card.
      });
    return () => {
      alive = false;
    };
  }, []);

  if (data === null || (!data.slack.available && !data.whatsapp.available && !data.email?.available)) return null;

  const update = async (key: string, body: MyNotificationChannelsInput): Promise<boolean> => {
    setBusy(key);
    setError(null);
    setTest(null);
    try {
      setData(await api.update(body));
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? firstError(e) : "That did not save.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const runTest = async (channel: ReachChannel) => {
    setBusy(`test-${channel}`);
    setError(null);
    setTest(null);
    try {
      setTest({ channel, result: await api.test(channel) });
    } catch (e) {
      setTest({
        channel,
        result: { ok: false, detail: e instanceof ApiError ? e.message : "The test could not be sent." },
      });
    } finally {
      setBusy(null);
    }
  };

  const testNote = (channel: ReachChannel) =>
    test?.channel === channel ? (
      <p
        role={test.result.ok ? "status" : "alert"}
        className={cx("mt-2 text-xs", test.result.ok ? "text-mint-700" : "text-error-700")}
      >
        {test.result.ok ? "Test sent. " : "Test failed. "}
        {test.result.detail}
      </p>
    ) : null;

  return (
    <SectionCard
      title="Where to reach me"
      subtitle={reachSubtitle([
        data.slack.available && "Slack",
        data.whatsapp.available && "WhatsApp",
        data.email && "email",
      ])}
      bodyClassName="p-0"
    >
      {error && (
        <p role="alert" className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-700">
          <AlertCircle size={15} className="shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <ul className="divide-y divide-neutral-100">
        <Row icon={Bell} tone="bg-primary-50 text-primary-700" title="In XwiftHQ" detail="The bell at the top of every page.">
          <Chip hue="slate">Always on</Chip>
        </Row>

        {data.slack.available && (
          <Row
            icon={Hash}
            tone="bg-grape-50 text-grape-700"
            title="Slack"
            detail={<SlackStatus slack={data.slack} />}
            below={
              <>
                {data.slack.enabled && data.slack.linked && (
                  <Button
                    size="sm"
                    icon={busy === "test-slack" ? undefined : Send}
                    disabled={busy !== null}
                    onClick={() => void runTest("slack")}
                    className="mt-2"
                  >
                    {busy === "test-slack" ? "Sending…" : "Send me a test"}
                  </Button>
                )}
                {testNote("slack")}
              </>
            }
          >
            <Switch
              label="Slack"
              checked={data.slack.enabled}
              disabled={busy !== null}
              onChange={(v) => void update("slack", { slack: { enabled: v } })}
            />
          </Row>
        )}

        {data.whatsapp.available && (
          <WhatsAppRow
            wa={data.whatsapp}
            busy={busy}
            onTurnOn={(number) => update("whatsapp", { whatsapp: { enabled: true, number, consent: true } })}
            onTurnOff={() => void update("whatsapp", { whatsapp: { enabled: false } })}
            onTest={() => void runTest("whatsapp")}
            testNote={testNote("whatsapp")}
          />
        )}

        {data.email && (
          <Row
            icon={Mail}
            tone="bg-sky-50 text-sky-700"
            title="Email"
            detail={
              data.email.available ? (
                <>
                  Send my project alerts to{" "}
                  <span className="font-semibold text-neutral-700">{data.email.address}</span>
                </>
              ) : (
                <>
                  Your organisation hasn&apos;t switched on a mailbox yet. An admin or delivery lead can connect Gmail
                  or Zoho Mail under Integrations.
                </>
              )
            }
            below={
              <>
                {data.email.available && data.email.enabled && (
                  <Button
                    size="sm"
                    icon={busy === "test-email" ? undefined : Send}
                    disabled={busy !== null}
                    onClick={() => void runTest("email")}
                    className="mt-2"
                  >
                    {busy === "test-email" ? "Sending…" : "Send me a test"}
                  </Button>
                )}
                {testNote("email")}
              </>
            }
          >
            <Switch
              label="Email"
              checked={data.email.available && data.email.enabled}
              disabled={busy !== null || !data.email.available}
              onChange={(v) => void update("email", { email: { enabled: v } })}
            />
          </Row>
        )}
      </ul>
    </SectionCard>
  );
}

function SlackStatus({ slack }: { slack: MyNotificationChannels["slack"] }) {
  if (!slack.enabled) return <>Direct messages from your organisation&apos;s Slack app.</>;
  if (slack.problem) {
    return (
      <span className="flex items-start gap-1.5 text-sun-700">
        <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
        {slack.problem}
      </span>
    );
  }
  if (slack.linked) {
    return (
      <span className="inline-flex items-center gap-1">
        <Check size={12} className="text-mint-600" aria-hidden />
        Linked as{" "}
        <span className="font-semibold text-neutral-700">
          {slack.handle ? `@${slack.handle.replace(/^@/, "")}` : "you"}
        </span>
      </span>
    );
  }
  return <>Looking for your work email in Slack…</>;
}

function WhatsAppRow({
  wa,
  busy,
  onTurnOn,
  onTurnOff,
  onTest,
  testNote,
}: {
  wa: MyNotificationChannels["whatsapp"];
  busy: string | null;
  onTurnOn: (number: string) => Promise<boolean>;
  onTurnOff: () => void;
  onTest: () => void;
  testNote: React.ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const [number, setNumber] = useState(wa.number ?? wa.suggestedNumber ?? "");
  const [consent, setConsent] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const ids = useId();

  const fromHr = !wa.number && !!wa.suggestedNumber && number === wa.suggestedNumber;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normaliseE164(number);
    if (clean === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (!consent) return;
    if (await onTurnOn(clean)) {
      setAsking(false);
      setConsent(false);
    }
  };

  const detail = wa.enabled ? (
    <>
      Sending to <span className="font-semibold tabular-nums text-neutral-700">{wa.number}</span>
      {wa.optedInAt && <> · you agreed on {new Date(wa.optedInAt).toLocaleDateString()}</>}
    </>
  ) : (
    <>Short messages to your phone, only if you agree to them.</>
  );

  return (
    <Row
      icon={MessageCircle}
      tone="bg-mint-50 text-mint-700"
      title="WhatsApp"
      detail={detail}
      below={
        <>
          {wa.enabled && (
            <Button
              size="sm"
              icon={busy === "test-whatsapp" ? undefined : Send}
              disabled={busy !== null}
              onClick={onTest}
              className="mt-2"
            >
              {busy === "test-whatsapp" ? "Sending…" : "Send me a test"}
            </Button>
          )}
          {testNote}
          {asking && !wa.enabled && (
            <form onSubmit={(e) => void submit(e)} noValidate className="mt-3 space-y-3 rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200/70">
              <div>
                <label htmlFor={`${ids}-num`} className="mb-1.5 block text-[13px] font-semibold text-neutral-700">
                  WhatsApp number
                </label>
                <input
                  id={`${ids}-num`}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    setInvalid(false);
                  }}
                  onBlur={() => setInvalid(number.trim() !== "" && normaliseE164(number) === null)}
                  placeholder="+2348012345678"
                  aria-invalid={invalid}
                  aria-describedby={`${ids}-num-hint`}
                  className={cx(
                    "h-11 w-full max-w-xs rounded-xl border bg-white px-3.5 text-sm tabular-nums text-neutral-900 outline-none transition focus:ring-4",
                    invalid
                      ? "border-error-400 focus:ring-error-100"
                      : "border-neutral-200 focus:border-primary-400 focus:ring-primary-100",
                  )}
                />
                <p id={`${ids}-num-hint`} className={cx("mt-1.5 text-xs", invalid ? "text-error-700" : "text-neutral-500")}>
                  {invalid
                    ? "Enter the number with its country code, starting with +, for example +2348012345678."
                    : fromHr
                      ? "From your HR record. Change it if WhatsApp is on a different number."
                      : "With its country code, starting with +."}
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-neutral-300 accent-primary-600"
                />
                <span>
                  I agree to receive work notifications from my organisation on WhatsApp at this number. I can turn
                  this off here at any time.
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" size="sm" disabled={!consent || number.trim() === "" || busy !== null}>
                  {busy === "whatsapp" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Check size={15} aria-hidden />}
                  Turn on WhatsApp
                </Button>
                <Button size="sm" onClick={() => setAsking(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </>
      }
    >
      <Switch
        label="WhatsApp"
        checked={wa.enabled || asking}
        disabled={busy !== null}
        onChange={(v) => {
          if (wa.enabled && !v) onTurnOff();
          else if (!wa.enabled) setAsking(v);
        }}
      />
    </Row>
  );
}

function Row({
  icon: Icon,
  tone,
  title,
  detail,
  below,
  children,
}: {
  icon: typeof Bell;
  tone: string;
  title: string;
  detail: React.ReactNode;
  below?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-5 py-4">
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-800">{title}</p>
        <div className="text-xs text-neutral-500">{detail}</div>
        {below}
      </div>
      <div className="shrink-0 pt-1">{children}</div>
    </li>
  );
}

function Switch({
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

/** Laravel puts the useful sentence under the field; prefer it to the summary. */
function firstError(e: ApiError): string {
  if (e.errors) {
    for (const list of Object.values(e.errors)) {
      if (Array.isArray(list) && list[0]) return list[0];
    }
  }
  return e.message;
}

/**
 * The card's subtitle, naming only the channels shown below it. A fixed
 * "Add Slack, WhatsApp or email" promised a WhatsApp row to people whose
 * organisation has no WhatsApp number.
 */
export function reachSubtitle(channels: (string | false | null | undefined)[]): string {
  const names = channels.filter((c): c is string => typeof c === "string" && c !== "");
  const base = "Every notification lands in XwiftHQ.";
  if (names.length === 0) return base;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  return `${base} Add ${list} to get a copy there too.`;
}
