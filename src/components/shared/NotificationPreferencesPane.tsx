"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Pill, SectionCard } from "@/components/dashboard/ui";
import {
  ApiError,
  notificationPreferences as prefsApi,
  type NotificationPreference,
} from "@/lib/api/account-client";
import ReachChannels from "./ReachChannels";

/**
 * A person's own notification switches, wherever they happen to be standing.
 *
 * This used to live inside the instructor settings page, which meant the only
 * route to it was through the LMS teach console. The registry behind it
 * follows what each person does and had HRM entries from the day HRM
 * notifications were written — so an HR manager had three switches that existed, were honoured on
 * send, and could not be reached from anywhere in the product they used. A
 * preference nobody can find is the same as no preference.
 *
 * The list is whatever the backend registry says this person may configure. It
 * is deliberately not a hard-coded set of rows: a switch with no notification
 * behind it does nothing, and a notification with no switch cannot be turned
 * off, and the only way to keep those two facts in step is to render the
 * registry.
 *
 * `platformEnabled` is the other gate. An admin can disable a notification for
 * everybody, and when they have, the row says so rather than leaving somebody's
 * switch on beside a message that never arrives.
 */
export default function NotificationPreferencesPane({
  title = "Your notifications",
  subtitle = "Every switch here turns a real message on or off.",
  footer,
}: {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}) {
  const [rows, setRows] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    prefsApi
      .list()
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((e: unknown) => {
        if (alive)
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not load your notification settings.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  async function toggle(key: string, enabled: boolean) {
    setBusy(true);
    setError(null);

    try {
      setRows(await prefsApi.update({ [key]: enabled }));
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not save that preference.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error !== null && (
        <p className="flex items-center gap-2 rounded-xl border border-error-500/30 bg-error-500/10 px-4 py-3 text-sm text-error-600">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </p>
      )}

      <SectionCard title={title} subtitle={subtitle} bodyClassName="p-0">
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-neutral-400">
            <Loader2 size={15} className="animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          /*
            Reachable and worth saying. The registry follows what each person
            does, so somebody with no roles, no job and no project genuinely has
            nothing to configure — and a blank card reads as a broken page.
          */
          <p className="px-5 py-10 text-sm text-neutral-500">
            There is nothing here to turn off yet. Switches appear as you are
            given work that sends notifications.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex items-start justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-800">
                      {row.label}
                    </p>
                    {!row.platformEnabled && (
                      <Pill tone="warning">Off platform-wide</Pill>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400">{row.effect}</p>
                  {!row.platformEnabled && (
                    <p className="mt-1 text-xs text-neutral-400">
                      An admin has disabled this notification for everyone, so
                      it will not be sent even while your switch is on.
                    </p>
                  )}
                </div>

                <Toggle
                  checked={row.enabled}
                  disabled={busy}
                  onChange={(v) => void toggle(row.key, v)}
                  label={row.label}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Slack / WhatsApp. Renders nothing until the organisation connects one. */}
      <ReachChannels />

      {footer}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
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
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-40 ${
        checked ? "bg-primary-600" : "bg-neutral-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
