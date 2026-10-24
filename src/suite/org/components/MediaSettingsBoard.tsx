"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, CloudUpload, Cloud, Database, FolderOpen, HardDrive, type LucideIcon } from "lucide-react";
import { Button, Card, Chip, Empty, Panel, cx, orbClass } from "@/components/workspace/kit";
import { hueFor, type Hue } from "@/components/workspace/modules";
import { inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import {
  ApiError,
  mediaSettings,
  type MediaConnection,
  type MediaField,
  type MediaProviderKey,
  type MediaProviderRow,
} from "@/lib/api/admin-client";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * Where this institution keeps its files.
 *
 * The screen is rendered from the API's own schema rather than from a form per
 * provider hard-coded here. Cloudinary wants a cloud name and a secret, S3
 * wants a key pair and a region, Drive wants a whole service-account JSON,
 * and three hand-written forms would drift from the backend the first time a
 * field changed.
 *
 * Two things this screen insists on.
 *
 * **A connection cannot be switched on until it has been tested.** The button
 * is disabled with a reason rather than hidden, because the alternative is an
 * institution believing its files go to S3 while every upload quietly lands on
 * the local disk.
 *
 * **A test reports what it reached.** "Connected" would not tell somebody they
 * had pasted last year's bucket; "Reached bucket lectures in eu-west-1" does.
 */
export default function MediaSettingsBoard() {
  const [rows, setRows] = useState<MediaProviderRow[] | null>(null);
  const [active, setActive] = useState<MediaProviderKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await mediaSettings.list();

      setRows(result.data);
      setActive(result.meta.activeProvider);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not load.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    mediaSettings
      .list()
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setActive(result.meta.activeProvider);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null && rows === null) {
    return (
      <Panel title="Media storage" icon={AlertTriangle} hue="coral">
        <Empty icon={AlertTriangle} hue="coral" title="That did not load" hint={error} />
      </Panel>
    );
  }

  if (rows === null) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-[1.25rem] bg-neutral-200/60" />
        <div className="grid gap-6 xl:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-[1.25rem] bg-neutral-200/60" />
          ))}
        </div>
      </div>
    );
  }

  const activeRow = rows.find((r) => r.provider === active);

  return (
    <div className="space-y-6">
      {/*
        The question an administrator opens this screen to answer, before any
        of the forms: where do our files actually go right now.
      */}
      <Card className="xw-glow-card overflow-hidden">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <span
            className={cx(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
              orbClass(active === null ? "slate" : "blue"),
            )}
          >
            {active === null ? <HardDrive size={24} aria-hidden /> : <CloudUpload size={24} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Right now</p>
            <h2 className="mt-0.5 text-xl font-bold tracking-tight text-neutral-900">
              {active === null ? "Files are stored on this server" : `Files go to ${activeRow?.label}`}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {active === null
                ? "Nothing is set up, so uploads land on the server that runs XwiftHQ. That works, but it does not scale. Set up a provider below when you are ready."
                : "New uploads go here. Anything already stored elsewhere stays where it is."}
            </p>
          </div>
          <ol className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-semibold text-neutral-700" aria-label="How to switch a provider on">
            {["Save", "Test", "Switch on"].map((step, n) => (
              <li key={step} className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-1 pr-3 text-primary-700">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold shadow-sm">
                    {n + 1}
                  </span>
                  {step}
                </span>
                {n < 2 && <span className="h-px w-4 bg-primary-200" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="gap-6 xl:columns-2">
        {rows.map((row) => (
          <div key={row.provider} className="mb-6 break-inside-avoid">
            <ProviderCard row={row} onChanged={load} />
          </div>
        ))}
      </div>
    </div>
  );
}

const PROVIDER_LOOK: Record<string, { icon: LucideIcon; hue: Hue }> = {
  cloudinary: { icon: Cloud, hue: "sky" },
  s3: { icon: Database, hue: "sun" },
  google_drive: { icon: FolderOpen, hue: "mint" },
  drive: { icon: FolderOpen, hue: "mint" },
};

function providerLook(key: string): { icon: LucideIcon; hue: Hue } {
  return PROVIDER_LOOK[key] ?? { icon: CloudUpload, hue: hueFor(key) };
}

function ProviderCard({
  row,
  onChanged,
}: {
  row: MediaProviderRow;
  onChanged: () => void;
}) {
  const connection = row.connection;

  const [draft, setDraft] = useState<Record<string, string>>({
    ...(connection?.credentials ?? {}),
    ...(connection?.settings ?? {}),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /*
    Disconnecting is confirmed first. It cannot be undone by re-entering the
    credentials: the connection row goes, and every file that was stored
    through it is orphaned in the library. So the count is put in front of
    somebody in the confirmation, not in the message afterwards.
  */
  const confirm = useConfirm();

  const disconnect = async () => {
    if (connection === null) return;
    const ok = await confirm({
      title: `Disconnect ${row.label}?`,
      body: `${removalWarning(connection)} Nothing goes to the recycle bin.`,
      confirmLabel: "Disconnect",
    });
    if (!ok) return;

    await run("disconnect", async () => {
      const result = await mediaSettings.disconnect(row.provider);
      setDraft({});
      return result.message;
    });
  };

  const run = async (key: string, action: () => Promise<string | null>) => {
    setBusy(key);
    setProblem(null);
    setMessage(null);

    try {
      setMessage(await action());
      onChanged();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      const credentials: Record<string, string> = {};
      const settings: Record<string, string> = {};

      for (const field of row.credentialFields) {
        if (draft[field.name] !== undefined) credentials[field.name] = draft[field.name];
      }

      for (const field of row.settingFields) {
        if (draft[field.name] !== undefined) settings[field.name] = draft[field.name];
      }

      await mediaSettings.save(row.provider, { credentials, settings });

      return "Saved. Test it before switching it on.";
    });

  const verify = () =>
    run("verify", async () => {
      const result = await mediaSettings.verify(row.provider);

      return result.message;
    });

  const look = providerLook(row.provider);

  return (
    <Panel
      title={row.label}
      subtitle={statusLine(connection)}
      icon={look.icon}
      hue={look.hue}
      className={connection?.isActive === true ? "ring-2 ring-mint-100" : undefined}
      actions={
        connection?.isActive === true ? (
          <Chip hue="mint" icon={Check}>
            {connection.isDefault ? "In use" : "On"}
          </Chip>
        ) : connection === null ? (
          <Chip hue="slate">Not set up</Chip>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/*
          The provider's own words, kept from the last failed test. The failure
          usually happens inside an upload at 3am and this screen is where
          somebody looks the next morning.
        */}
        {connection?.lastError != null && (
          <p className="flex items-start gap-2.5 rounded-2xl bg-error-500/5 px-4 py-3 text-sm text-error-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {connection.lastError}
          </p>
        )}

        {problem !== null && (
          <p className="flex items-start gap-2.5 rounded-2xl bg-error-500/5 px-4 py-3 text-sm text-error-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {problem}
          </p>
        )}

        {message !== null && (
          <p className="flex items-start gap-2.5 rounded-2xl bg-mint-50 px-4 py-3 text-sm font-medium text-mint-700">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
            {message}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {[...row.credentialFields, ...row.settingFields].map((field) => (
            <Field
              key={field.name}
              field={field}
              value={draft[field.name] ?? ""}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, [field.name]: value }))
              }
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
          <Button variant="primary" size="sm" disabled={busy !== null} onClick={() => void save()}>
            Save
          </Button>

          <Button size="sm" disabled={busy !== null || connection === null} onClick={() => void verify()}>
            Test connection
          </Button>

          {/*
            Disabled with a reason rather than hidden. An institution that
            cannot see why it may not switch this on will assume it is broken.
          */}
          <Button
            size="sm"
            disabled={busy !== null || !canActivate(connection)}
            title={activateHint(connection)}
            onClick={() =>
              void run("activate", async () => {
                await mediaSettings.activate(
                  row.provider,
                  !(connection?.isActive ?? false),
                );

                return connection?.isActive === true
                  ? "Switched off. New uploads go elsewhere."
                  : "Switched on.";
              })
            }
          >
            {connection?.isActive === true ? "Switch off" : "Switch on"}
          </Button>

          {connection?.isActive === true && !connection.isDefault && (
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                void run("default", async () => {
                  await mediaSettings.makeDefault(row.provider);

                  return "New uploads will go here.";
                })
              }
            >
              Send uploads here
            </Button>
          )}

          {connection !== null && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => void disconnect()}
              className="!text-error-700 hover:!bg-error-500/5"
            >
              Disconnect
            </Button>
          )}

          {connection !== null && connection.fileCount > 0 && (
            <span className="ml-auto text-xs text-neutral-500">
              {connection.fileCount} file
              {connection.fileCount === 1 ? "" : "s"} stored
            </span>
          )}
        </div>

      </div>
    </Panel>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: MediaField;
  value: string;
  onChange: (value: string) => void;
}) {
  // The service-account JSON is a whole file; a single-line input would be
  // unusable and people would paste it truncated.
  const isBlob = field.name === "service_account_json";

  return (
    <label className={`block ${isBlob ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">
        {field.label}
        {!field.required && (
          <span className="ml-1 text-xs font-normal text-neutral-500">optional</span>
        )}
      </span>

      {isBlob ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={cx(textareaClass, "font-mono text-xs")}
        />
      ) : (
        <input
          type={field.secret ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.hint !== null && (
        <span className="mt-1.5 block text-xs text-neutral-500">
          {field.hint}
        </span>
      )}
    </label>
  );
}

/* ------------------------------------------------------------------ */

function canActivate(connection: MediaConnection | null): boolean {
  if (connection === null) return false;
  if (connection.isActive) return true;

  return connection.isComplete && connection.lastVerifiedAt !== null;
}

/**
 * What disconnecting actually costs, said before it happens.
 *
 * The API reports the orphan count in its response, which is too late to be
 * a decision. The same number is already on this screen, so it is spent here.
 */
function removalWarning(connection: MediaConnection): string {
  const base =
    "The credentials are deleted. Re-entering them later means testing and switching this on again.";

  if (connection.fileCount === 0) return base;

  return (
    `${connection.fileCount} file${connection.fileCount === 1 ? "" : "s"} ` +
    `stored here ${connection.fileCount === 1 ? "stays" : "stay"} in the library ` +
    `and can no longer be opened, and any lesson pointing at ${connection.fileCount === 1 ? "it" : "them"} ` +
    `will tell learners the media is missing. ${base}`
  );
}

function activateHint(connection: MediaConnection | null): string | undefined {
  if (connection === null) return "Save the details first.";
  if (connection.isActive) return undefined;

  if (!connection.isComplete) {
    return `Fill in ${connection.missing.join(", ")} first.`;
  }

  if (connection.lastVerifiedAt === null) {
    return "Test the connection before switching it on.";
  }

  return undefined;
}

function statusLine(connection: MediaConnection | null): string {
  if (connection === null) return "Not set up.";

  if (!connection.isComplete) {
    return `Missing ${connection.missing.join(", ")}.`;
  }

  if (connection.lastVerifiedAt === null) {
    return "Saved, but never tested.";
  }

  if (connection.isActive) {
    return connection.isDefault
      ? "Switched on, and new uploads come here."
      : "Switched on.";
  }

  return "Tested and ready. Not switched on.";
}
