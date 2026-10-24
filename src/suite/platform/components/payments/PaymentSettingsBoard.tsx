"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, CreditCard, FlaskConical, KeyRound, Webhook } from "lucide-react";
import { Button, CalloutStrip, Card, Chip, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote } from "@/suite/lms/components/ui/ws";
import { useAuth } from "@/lib/auth-store";
import {
  ApiError,
  gatewayLabel,
  platformPaymentSettings,
  type GatewayStatus,
} from "@/lib/api/platform-billing-client";
import { canPlatform, PERM } from "@/suite/platform/access";
import { LoadError, Notice, PageSkeleton, useLoad } from "../ui";

/** A webhook URL the gateway can't reach: localhost, a LAN address, or plain http. */
function unreachable(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "localhost" ||
      u.hostname.endsWith(".localhost") ||
      /^127\./.test(u.hostname) ||
      /^10\./.test(u.hostname) ||
      /^192\.168\./.test(u.hostname) ||
      u.hostname === "0.0.0.0"
    );
  } catch {
    return true;
  }
}

/**
 * Which gateway checkout uses, and what each gateway needs to be told about us.
 *
 * Switching is one setting for the whole platform: modules and seats both move.
 * Payments already in flight finish on the gateway they started on: the
 * reconciliation queue verifies each payment with its own gateway.
 */
export default function PaymentSettingsBoard() {
  const { user } = useAuth();
  const canManage = canPlatform(user, PERM.settings);
  const confirm = useConfirm();

  const fetchSettings = useCallback(() => platformPaymentSettings.get(), []);
  const { data, error, reload, setData } = useLoad(fetchSettings, "Payment settings didn't load.");

  const [switching, setSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function choose(g: GatewayStatus) {
    if (!data || g.key === data.gateway || switching) return;
    setSwitchError(null);
    const ok = await confirm({
      title: `Take payments through ${g.label}?`,
      body: (
        <>
          New checkouts, for modules and for seats, will use <strong>{g.label}</strong>
          {g.testMode ? " in test mode, so no real money moves" : ""}. Payments already started on{" "}
          {gatewayLabel(data.gateway)} finish there.
        </>
      ),
      confirmLabel: `Use ${g.label}`,
      tone: "primary",
    });
    if (!ok) return;
    setSwitching(g.key);
    try {
      const saved = await platformPaymentSettings.setGateway(g.key);
      setData(() => saved);
      setNotice(`New checkouts now use ${g.label}.`);
    } catch (e) {
      setSwitchError(e instanceof ApiError ? e.message : `Checkout wasn't switched to ${g.label}.`);
    } finally {
      setSwitching(null);
    }
  }

  const header = (
    <PageHeader
      eyebrow="Commerce"
      title="Payment gateway"
      subtitle="Choose where organisations pay for modules and seats, and copy the addresses each gateway needs."
    />
  );

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <LoadError message={error} onRetry={reload} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {header}
        <PageSkeleton stats={0} rows={2} />
      </div>
    );
  }

  const selected = data.gateways.find((g) => g.key === data.gateway);
  const anyLocal = data.gateways.some((g) => unreachable(g.webhookUrl));

  return (
    <div className="space-y-6">
      {header}

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {selected && !selected.configured && (
        <p role="alert" className="flex items-center gap-3 rounded-2xl border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-700">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm" aria-hidden>
            <AlertTriangle size={18} />
          </span>
          <span>
            Checkout is set to {selected.label}, but its keys aren&apos;t configured on the server. Organisations can&apos;t
            pay until you add them, or switch gateway.
          </span>
        </p>
      )}

      <section aria-labelledby="gateway-choice">
        <h2 id="gateway-choice" className="mb-4 text-lg font-bold tracking-tight text-neutral-900">
          Checkout gateway
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2" role="radiogroup" aria-label="Checkout gateway">
          {data.gateways.map((g) => (
            <GatewayCard
              key={g.key}
              gateway={g}
              selected={g.key === data.gateway}
              busy={switching === g.key}
              canManage={canManage}
              onChoose={() => void choose(g)}
            />
          ))}
        </div>
        {switchError && <ErrorNote className="mt-3">{switchError}</ErrorNote>}
        {!canManage && <p className="mt-3 text-sm text-neutral-500">Your platform role can see these settings but not change them.</p>}
      </section>

      {anyLocal && (
        <CalloutStrip icon={AlertTriangle} hue="sun" title="These webhook addresses point at this machine">
          A gateway can&apos;t reach this machine from the internet. That is fine for local testing: when a payer returns
          from checkout, the return page asks the gateway to verify the payment and grants the module or seats then. Once
          the platform runs at a public address (or behind a tunnel), register the webhook so payments that never return
          are still caught.
        </CalloutStrip>
      )}

      {data.gateways.map((g) => (
        <GatewayAddresses key={g.key} gateway={g} local={unreachable(g.webhookUrl)} />
      ))}
    </div>
  );
}

function GatewayCard({
  gateway: g,
  selected,
  busy,
  canManage,
  onChoose,
}: {
  gateway: GatewayStatus;
  selected: boolean;
  busy: boolean;
  canManage: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={!canManage || selected || busy}
      onClick={onChoose}
      className={cx(
        "ws-card flex w-full items-start gap-4 p-5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
        selected
          ? "!border-primary-400 ring-2 ring-primary-200"
          : "enabled:cursor-pointer enabled:hover:-translate-y-0.5 enabled:hover:shadow-md motion-reduce:enabled:hover:translate-y-0",
        !selected && !canManage && "opacity-80",
      )}
    >
      <span
        className={cx(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
          HUE[g.key === "flutterwave" ? "sun" : "sky"].soft,
        )}
        aria-hidden
      >
        {g.key === "flutterwave" ? <Webhook size={22} /> : <CreditCard size={22} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold tracking-tight text-neutral-900">{g.label}</span>
          {selected && <Chip hue="blue">In use</Chip>}
        </span>
        <span className="mt-2 flex flex-wrap gap-2">
          {g.configured ? (
            <Chip hue="mint" icon={CheckCircle2}>
              Keys configured
            </Chip>
          ) : (
            <Chip hue="rose" icon={AlertTriangle}>
              Keys missing
            </Chip>
          )}
          {g.configured && (g.testMode ? (
            <Chip hue="sun" icon={FlaskConical}>
              Test mode
            </Chip>
          ) : (
            <Chip hue="grape">Live</Chip>
          ))}
          {g.secretHashConfigured === false && (
            <Chip hue="rose" icon={KeyRound}>
              Secret hash missing
            </Chip>
          )}
        </span>
        <span className="mt-2 block text-sm text-neutral-500">
          {busy
            ? "Switching…"
            : selected
              ? "New checkouts go here."
              : g.configured
                ? `Select to send new checkouts to ${g.label}.`
                : "Add its keys to the server's environment before you select it."}
        </span>
      </span>
      <span
        className={cx(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary-600 bg-primary-600 text-white" : "border-neutral-300",
        )}
        aria-hidden
      >
        {selected && <Check size={13} strokeWidth={3} />}
      </span>
    </button>
  );
}

function GatewayAddresses({ gateway: g, local }: { gateway: GatewayStatus; local: boolean }) {
  const isFlutterwave = g.key === "flutterwave";
  return (
    <Panel
      title={`${g.label} addresses`}
      subtitle={isFlutterwave ? "Paste these into your Flutterwave dashboard" : "Paste the webhook into your Paystack dashboard"}
      icon={isFlutterwave ? Webhook : CreditCard}
      hue={isFlutterwave ? "sun" : "sky"}
    >
      <div className="space-y-4">
        <CopyField label="Webhook URL" value={g.webhookUrl} warn={local ? "Not reachable from the internet" : undefined} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CopyField label="Return page: modules" value={g.callbackUrls.modules} />
          <CopyField label="Return page: seats" value={g.callbackUrls.seats} />
        </div>
        <p className="text-xs text-neutral-500">
          Each checkout sends its return page automatically. They are listed here so you can spot them in the gateway&apos;s logs.
        </p>

        {isFlutterwave ? (
          <Card className="!border-transparent bg-sun-50/60 p-5 shadow-none">
            <h3 className="text-sm font-semibold text-neutral-900">Register the webhook with Flutterwave</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-neutral-700">
              <li>Open the Flutterwave dashboard → <strong>Settings</strong> → <strong>Webhooks</strong>.</li>
              <li>Paste the webhook URL above into <strong>URL</strong>.</li>
              <li>
                Paste the value of <code className="rounded bg-neutral-200/70 px-1 py-0.5 text-xs">FLUTTERWAVE_SECRET_HASH</code>{" "}
                from the server&apos;s <code className="rounded bg-neutral-200/70 px-1 py-0.5 text-xs">.env</code> into{" "}
                <strong>Secret hash</strong>. Flutterwave sends it with every webhook, and the platform refuses any webhook
                that doesn&apos;t carry it.
              </li>
              <li>Tick <strong>Receive webhook response in JSON format</strong> and save.</li>
            </ol>
            <p className={cx("mt-3 flex items-center gap-1.5 text-sm", g.secretHashConfigured ? "text-mint-700" : "text-error-700")}>
              {g.secretHashConfigured ? <CheckCircle2 size={15} aria-hidden /> : <AlertTriangle size={15} aria-hidden />}
              {g.secretHashConfigured
                ? "The server has a secret hash set."
                : "The server has no FLUTTERWAVE_SECRET_HASH yet, so every Flutterwave webhook will be refused until it does."}
            </p>
          </Card>
        ) : (
          <p className="text-sm text-neutral-600">
            In the Paystack dashboard → <strong>Settings</strong> → <strong>API Keys &amp; Webhooks</strong>, paste the webhook
            URL. Paystack signs each webhook with your secret key, so there is nothing else to copy.
          </p>
        )}
      </div>
    </Panel>
  );
}

function CopyField({ label, value, warn }: { label: string; value: string; warn?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-neutral-700">{label}</span>
        {warn && (
          <Chip hue="sun" icon={AlertTriangle}>
            {warn}
          </Chip>
        )}
      </div>
      <div className="flex gap-2">
        <code className="flex h-11 min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-xs text-neutral-800">
          {value}
        </code>
        <span aria-live="polite">
          <Button icon={copied ? Check : Copy} onClick={() => void copy()} aria-label={`Copy ${label}`}>
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </span>
      </div>
    </div>
  );
}
