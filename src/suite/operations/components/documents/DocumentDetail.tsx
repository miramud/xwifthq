"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Archive, CalendarClock, Download, Eye, Fingerprint, Gavel, History, Hourglass, Link2, PenLine, ShieldOff, Trash2 } from "lucide-react";
import { Button, Card, Chip, PageHeader, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { todayYmd } from "@/components/workspace/Calendar";
import { HUE } from "@/components/workspace/modules";
import { BackLink, ErrorNote, Field, IconTile, ListRow, Skeleton, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { isAdminRole } from "@/lib/roles";
import { stampOf } from "@/suite/operations/components/assets/labels";
import { FactRow } from "@/suite/operations/components/travel/shared";
import { daysBetween } from "@/suite/operations/components/compliance/labels";
import { ApiError, linksOf, repoError, repository, type RepoDocumentFull, type RepositoryMeta } from "@/lib/api/repository-client";
import { DocumentDialog } from "./DocumentDialog";
import { LevelChip, accessText, docCategoryHue, FileTypeIcon, fileSize, levelMeta, moduleText } from "./parts";

/**
 * One document: what it is and what it belongs to (editable), where in the
 * suite it is attached, how long it is kept and why, legal hold, a request
 * to dispose of it, and who has opened it when it is sensitive.
 */
export default function DocumentDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [doc, setDoc] = useState<RepoDocumentFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<"edit" | "hold" | "dispose" | null>(null);
  const [lists, setLists] = useState<RepositoryMeta | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    repository.get(id).then(
      (d) => {
        if (!alive) return;
        setDoc(d);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This document wasn't found, or you may not see it." : `This document didn't load. ${repoError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !doc) {
    return (
      <div>
        <BackLink href="/suite/operations/documents" label="Document repository" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!doc) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the document…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const d = doc;
  const admin = isAdminRole(user);
  const links = linksOf(d);
  const sensitive = d.confidentiality !== "public_internal";
  const pendingDisposal = d.disposal && d.disposal.status === "requested";
  const expiryDays = d.expiresOn ? daysBetween(today, d.expiresOn) : null;

  const openEdit = () => {
    setDialog("edit");
    if (!lists) repository.list({ q: "" }).then((r) => setLists(r.meta), (e: unknown) => setActionError(repoError(e)));
  };

  const liftHold = async () => {
    const ok = await confirm({
      title: "Lift the legal hold?",
      body: "Its retention runs again, and it can be disposed of once that ends.",
      confirmLabel: "Lift hold",
      tone: "primary",
    });
    if (!ok) return;
    setActionError(null);
    try {
      setDoc({ ...d, ...(await repository.hold(d.id, false)) });
    } catch (e) {
      setActionError(repoError(e));
    }
  };

  return (
    <div>
      <BackLink href="/suite/operations/documents" label="Document repository" />
      <PageHeader
        eyebrow={[d.categoryLabel, d.docType].filter(Boolean).join(" · ")}
        title={d.title}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <LevelChip level={d.confidentiality} />
            {d.legalHold && (
              <Chip hue="grape" icon={Gavel}>
                Legal hold
              </Chip>
            )}
            {expiryDays !== null && (
              <Chip hue={expiryDays < 0 ? "rose" : expiryDays <= 60 ? "sun" : "mint"} icon={CalendarClock}>
                {expiryDays < 0 ? `Expired ${day(d.expiresOn)}` : expiryDays === 0 ? "Expires today" : `Expires in ${expiryDays} days`}
              </Chip>
            )}
          </span>
        }
        actions={
          <>
            <Button icon={PenLine} onClick={openEdit}>
              Edit details
            </Button>
            <a href={repository.downloadHref(d.id)} className={buttonClass("primary")}>
              <Download size={17} aria-hidden />
              Download
            </a>
          </>
        }
      />

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      {pendingDisposal && d.disposal && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-sun-500/25 bg-sun-50 px-4 py-3.5 text-sm text-sun-700">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
            <Hourglass size={18} aria-hidden />
          </span>
          <p>
            <span className="block font-semibold">Disposal asked for: waiting for the document controller</span>
            {d.disposal.reason}
          </p>
        </div>
      )}

      <Card className="mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className={cx("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", HUE[docCategoryHue(d.category)].soft)}>
          <FileTypeIcon mime={d.mime} name={d.fileName} size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold text-neutral-900">{d.fileName}</p>
          <p className="text-xs text-neutral-500">
            {[fileSize(d.size), d.mime, d.hasText ? "searchable by its text" : "not searchable by its text"].filter(Boolean).join(" · ")}
          </p>
        </div>
        {d.sha256 && (
          <p className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-50 px-2.5 py-1.5 font-mono text-[11px] text-neutral-600" title={d.sha256}>
            <Fingerprint size={13} aria-hidden />
            {d.sha256.slice(0, 12)}…
            <span className="sr-only">Fingerprint {d.sha256}</span>
          </p>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="Details" subtitle="What it is and what it belongs to" icon={Eye} hue="sky">
            <dl className="grid gap-4 sm:grid-cols-3">
              <FactRow label="Reference">{d.reference ? <span className="font-mono">{d.reference}</span> : "-"}</FactRow>
              <FactRow label="Type">{d.docType ?? "-"}</FactRow>
              <FactRow label="Project">{d.project ? `${d.project.name}${d.project.code ? ` (${d.project.code})` : ""}` : "-"}</FactRow>
              <FactRow label="Client or vendor">{d.counterparty ?? "-"}</FactRow>
              <FactRow label="Document date">{day(d.documentDate)}</FactRow>
              <FactRow label="Effective from">{day(d.effectiveOn)}</FactRow>
              <FactRow label="Expires on">{day(d.expiresOn)}</FactRow>
              <FactRow label="Uploaded">{d.uploadedAt ? `${stampOf(d.uploadedAt)}${d.uploadedBy ? ` by ${d.uploadedBy}` : ""}` : "-"}</FactRow>
              <FactRow label="Who can see it">{levelMeta(d.confidentiality).hint}</FactRow>
            </dl>
            {d.tags.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Tags">
                {d.tags.map((t) => (
                  <li key={t}>
                    <Chip>{t}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Where it is used" subtitle="The records in the suite it is attached to" icon={Link2} hue="grape">
            {links === null ? (
              <p className="text-sm text-neutral-500">The records it is attached to aren&rsquo;t listed here yet. Open it from the record itself to see it in place.</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-neutral-500">Not attached to anything: it lives in the repository only.</p>
            ) : (
              <ul className="-mx-2 divide-y divide-neutral-100">
                {links.map((l, i) => (
                  <ListRow
                    key={`${l.ownerType}-${l.ownerId}-${i}`}
                    leading={<IconTile icon={Link2} hue="grape" />}
                    title={l.label ?? l.ownerType.replace(/_/g, " ")}
                    meta={l.ownerType.replace(/_/g, " ")}
                    trailing={
                      <span className="flex flex-col items-end gap-1">
                        <Chip hue="grape">{moduleText(l.module)}</Chip>
                        {l.at && <span className="text-xs text-neutral-500">{stampOf(l.at)}</span>}
                      </span>
                    }
                  />
                ))}
              </ul>
            )}
          </Panel>

          {sensitive && (
            <Panel title="Who opened it" subtitle="Every read of a confidential or restricted document, newest first" icon={History} hue="rose">
              {(d.accessLog ?? []).length === 0 ? (
                <p className="text-sm text-neutral-500">Nobody has opened it yet.</p>
              ) : (
                <ol className="space-y-2">
                  {(d.accessLog ?? []).map((a, i) => (
                    <li key={`${a.at}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-3.5 py-2.5 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-neutral-900">{a.by ?? "Someone"}</span> <span className="text-neutral-600">{accessText(a.action).toLowerCase()} it</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-neutral-500">{stampOf(a.at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <RetentionPanel doc={d} today={today} />

          <Panel title="Legal hold" subtitle="Kept beyond its retention while a matter is open" icon={Gavel} hue="grape">
            {d.legalHold ? (
              <div className="space-y-3">
                <p className="rounded-2xl bg-grape-50 px-3.5 py-3 text-sm text-grape-700">
                  <span className="font-semibold">On hold. </span>
                  {d.legalHoldReason ?? "No reason recorded."}
                </p>
                {admin && (
                  <Button icon={ShieldOff} onClick={() => void liftHold()} className="w-full">
                    Lift the hold
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-neutral-600">Not on hold.</p>
                {admin ? (
                  <Button icon={Gavel} onClick={() => setDialog("hold")} className="w-full">
                    Place a legal hold
                  </Button>
                ) : (
                  <p className="text-xs text-neutral-500">Only an admin places or lifts a legal hold.</p>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Disposal" icon={Archive} hue="slate">
            {d.disposal && !pendingDisposal ? (
              <p className="text-sm text-neutral-600">
                Last request: <span className="font-semibold">{d.disposal.status.replace(/_/g, " ")}</span>. {d.disposal.reason}
              </p>
            ) : pendingDisposal ? (
              <p className="text-sm text-neutral-600">Waiting for the document controller to approve it.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-neutral-600">
                  {d.legalHold ? "It cannot be disposed of while on legal hold." : "When its retention has ended, ask for it to be disposed of. The document controller approves it first."}
                </p>
                {!d.legalHold && (
                  <Button variant="danger" icon={Trash2} onClick={() => setDialog("dispose")} className="w-full">
                    Ask to dispose
                  </Button>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {dialog === "edit" && lists && (
        <DocumentDialog
          doc={d}
          lists={{ categories: lists.categories, retention: lists.retention }}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            setDialog(null);
            setDoc({ ...d, ...next, links: d.links });
            refresh();
          }}
        />
      )}
      {dialog === "hold" && (
        <ReasonDialog
          title="Place a legal hold"
          subtitle="It is kept, whatever its retention says, until the hold is lifted."
          label="The case or matter"
          placeholder="Suit FHC/ABJ/CS/114/2026"
          confirm="Place hold"
          onClose={() => setDialog(null)}
          run={async (reason) => {
            const next = await repository.hold(d.id, true, reason);
            setDoc({ ...d, ...next, links: d.links });
            setDialog(null);
          }}
        />
      )}
      {dialog === "dispose" && (
        <ReasonDialog
          title="Ask to dispose of this document?"
          subtitle="The document controller approves it first. Once approved the file is destroyed for good; a record that it existed is kept."
          label="Why it can go"
          placeholder="Retention ended on 31 Dec 2025; no open matter."
          confirm="Ask to dispose"
          danger
          onClose={() => setDialog(null)}
          run={async (reason) => {
            await repository.dispose(d.id, reason);
            setDialog(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

/** How long it is kept: a bar from its date to the day retention ends, with today on it. */
function RetentionPanel({ doc: d, today }: { doc: RepoDocumentFull; today: string }) {
  const start = d.documentDate ?? d.uploadedAt?.slice(0, 10) ?? null;
  const end = d.retentionEnds ?? null;
  const total = start && end ? daysBetween(start, end) : 0;
  const pct = total > 0 && start ? Math.max(0, Math.min(100, Math.round((daysBetween(start, today) / total) * 100))) : 0;
  const ended = end ? end < today : false;
  return (
    <Panel title="Retention" subtitle={retentionClassLabel(d.retentionClass)} icon={Hourglass} hue="sun">
      {end && start ? (
        <div>
          <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={`${pct}% of its retention has passed; ${ended ? "it ended" : "it ends"} ${day(end)}`}>
            <span className={cx("h-full rounded-full bg-gradient-to-r", ended ? "from-coral-400 to-coral-600" : "from-sun-300 to-sun-500")} style={{ width: `${pct}%` }} />
            <span className="ws-hatch h-full flex-1" />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-neutral-500">
            <span>{day(start)}</span>
            <span className="font-semibold text-neutral-800">{ended ? "Ended" : "Ends"} {day(end)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">{d.retentionClass === "corporate" ? "Kept for good." : "Kept until its end date is known."}</p>
      )}
      {d.whyKept && <p className="mt-3 rounded-2xl bg-neutral-50 px-3.5 py-3 text-sm text-neutral-700">{d.whyKept}</p>}
      {!d.whyKept && ended && !d.legalHold && <p className="mt-3 text-sm text-neutral-600">Its retention has ended. It can be disposed of.</p>}
    </Panel>
  );
}

const retentionClassLabel = (key: string) =>
  ({ financial: "Financial records", contracts: "Contracts", hr: "People records", corporate: "Corporate records", general: "General" })[key] ?? key;

/** A short form with one reason; the button names the action. */
function ReasonDialog({
  title,
  subtitle,
  label,
  placeholder,
  confirm,
  danger = false,
  onClose,
  run,
}: {
  title: string;
  subtitle: string;
  label: string;
  placeholder: string;
  confirm: string;
  danger?: boolean;
  onClose: () => void;
  run: (reason: string) => Promise<void>;
}) {
  const uid = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) {
          setFieldError("Say why.");
          return;
        }
        setBusy(true);
        setError(null);
        run(reason.trim()).catch((err: unknown) => {
          setError(repoError(err));
          setBusy(false);
        });
      }}
      titleId={`${uid}-title`}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy}>
            {busy ? "Saving…" : confirm}
          </Button>
        </div>
      }
    >
      <Field id={`${uid}-reason`} label={label}>
        <textarea id={`${uid}-reason`} className={textareaClass} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} aria-invalid={fieldError ? true : undefined} />
        <FieldError message={fieldError} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

