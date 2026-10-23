"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Cake,
  Download,
  FileText,
  Flag,
  Home,
  IdCard,
  Lock,
  Mail,
  PhoneCall,
  UserRound,
  Users,
} from "lucide-react";
import {
  ApiError,
  hrm,
  SELF_EDITABLE_COLUMNS,
  type EmergencyContact,
  type PersonalRecord,
  type SelfEditableDetails,
} from "@/lib/api/hrm-client";
import { Button, Card, Chip, Empty, PageHeader, Panel } from "@/components/workspace/kit";
import { DataView } from "@/components/workspace/DataView";
import { DecorAvatar } from "@/suite/hrm/components/ui2/me-kit";
import { Field } from "./Dialog";
import { InfoRow, LoadFailed, Notice, PageSkeleton, inputCls } from "@/suite/hrm/components/ui2/kit";
import { formatDate } from "@/suite/hrm/lib/format";

/**
 * Somebody maintaining their own details.
 *
 * `GET/PATCH /hrm/me/details` and `Employee::SELF_EDITABLE` were both built
 * and neither had a screen: the manager could edit anybody's record and nobody
 * could edit their own. A system where changing your address means emailing HR
 * is a system with a lot of wrong addresses, and the wrong address is found on
 * the day a P45 has to reach somebody who has already left.
 *
 * Two things this screen is careful about.
 *
 * **What cannot be changed is shown, not hidden.** A date of birth or a job
 * title missing from the form reads as an oversight, and the first thing
 * somebody does about an oversight is raise a ticket. Shown with the reason
 * beside it, it reads as a decision — and it tells them who to ask.
 *
 * **The editable set comes from the API.** `meta.editable` is
 * `SELF_EDITABLE` in column names. Hardcoding a second copy here is how a
 * field the backend stopped trusting somebody with stays editable in the UI
 * for a release, failing silently on save.
 */
export default function MyDetails() {
  const [record, setRecord] = useState<PersonalRecord | null>(null);
  const [editable, setEditable] = useState<Set<keyof SelfEditableDetails>>(
    new Set(),
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noRecord, setNoRecord] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await hrm.me.details();

      setRecord(result.data);
      setEditable(
        new Set(
          result.meta.editable
            .map((column) => SELF_EDITABLE_COLUMNS[column])
            .filter((key): key is keyof SelfEditableDetails => key !== undefined),
        ),
      );
      setError(null);
    } catch (e) {
      /*
        404 here means "you have no employment record", which is a normal
        thing to be: an examiner, a contractor billed through Finance. Anything
        else is a fault worth showing.
      */
      if (e instanceof ApiError && e.status === 404) {
        setNoRecord(true);
      } else {
        setError(e instanceof Error ? e.message : "That did not load.");
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <PageHeader
      eyebrow="My employment"
      title="My details"
      subtitle="Where you live, how to reach you, and what HR holds about you."
    />
  );

  if (!loaded) {
    return <PageSkeleton stats={0} />;
  }

  if (noRecord) {
    return (
      <div>
        {header}
        <Card>
          <Empty
            icon={UserRound}
            title="You have no employment record here"
            hint="That is not a problem — plenty of accounts belong to people this organisation works with rather than employs."
          />
        </Card>
      </div>
    );
  }

  if (record === null) {
    return (
      <div>
        {header}
        <LoadFailed icon={AlertTriangle} title="Could not load" message={error ?? "That did not load."} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {error !== null && <Notice tone="error">{error}</Notice>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <DetailsForm
            record={record}
            editable={editable}
            onSaved={(updated) => setRecord(updated)}
          />
        </div>
        <div className="space-y-6">
          <HeldAboutYou record={record} />
          <YourDocuments record={record} />
          <EmergencyContacts record={record} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The part they may change                                           */
/* ------------------------------------------------------------------ */

const FIELDS: {
  key: keyof SelfEditableDetails;
  label: string;
  hint?: string;
  type?: string;
  maxLength: number;
  wide?: boolean;
}[] = [
  { key: "addressLine1", label: "Address", maxLength: 255, wide: true },
  {
    key: "addressLine2",
    label: "Address line 2",
    maxLength: 255,
    wide: true,
  },
  { key: "city", label: "Town or city", maxLength: 96 },
  { key: "state", label: "County or state", maxLength: 96 },
  { key: "postcode", label: "Postcode", maxLength: 24 },
  { key: "country", label: "Country", maxLength: 64 },
  {
    key: "personalEmail",
    label: "Personal email",
    hint: "Not your work address — that stops answering the day you leave.",
    type: "email",
    maxLength: 255,
  },
  {
    key: "personalPhone",
    label: "Personal phone",
    hint: "The number that still works after you leave.",
    maxLength: 32,
  },
  { key: "maritalStatus", label: "Marital status", maxLength: 24 },
];

function DetailsForm({
  record,
  editable,
  onSaved,
}: {
  record: PersonalRecord;
  editable: Set<keyof SelfEditableDetails>;
  onSaved: (updated: PersonalRecord) => void;
}) {
  const initial = useCallback(
    () =>
      Object.fromEntries(
        FIELDS.map((f) => [f.key, (record[f.key] as string | null) ?? ""]),
      ) as Record<keyof SelfEditableDetails, string>,
    [record],
  );

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const shown = FIELDS.filter((f) => editable.has(f.key));

  const dirty = shown.some(
    (f) => form[f.key] !== ((record[f.key] as string | null) ?? ""),
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setProblem(null);
    setSaved(false);

    try {
      /*
        Only what changed, and an emptied field as null rather than "". A
        cleared address means "we do not hold this"; an empty string is a
        value, and it sorts and matches like any other.
      */
      const patch = Object.fromEntries(
        shown
          .filter((f) => form[f.key] !== ((record[f.key] as string | null) ?? ""))
          .map((f) => [f.key, form[f.key] === "" ? null : form[f.key]]),
      );

      onSaved(await hrm.me.saveDetails(patch));
      setSaved(true);
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  };

  if (shown.length === 0) {
    return (
      <Panel title="Your details" icon={Home} hue="sky">
        <Empty
          icon={Lock}
          hue="slate"
          title="Nothing here is yours to change"
          hint="Ask HR to update your record."
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Your details"
      subtitle="Where you live and how to reach you. Changes take effect immediately."
      icon={Home}
      hue="sky"
    >
      <form onSubmit={save} className="space-y-5">
        {problem !== null && <Notice tone="error">{problem}</Notice>}

        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((field) => (
            <Field
              key={field.key}
              id={`my-${field.key}`}
              label={field.label}
              hint={field.hint}
              className={field.wide ? "sm:col-span-2" : ""}
            >
              <input
                id={`my-${field.key}`}
                type={field.type ?? "text"}
                value={form[field.key]}
                onChange={(e) => {
                  const { value } = e.target;

                  setSaved(false);
                  setForm((f) => ({ ...f, [field.key]: value }));
                }}
                maxLength={field.maxLength}
                aria-describedby={
                  field.hint ? `my-${field.key}-hint` : undefined
                }
                className={inputCls}
              />
            </Field>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <Button type="submit" variant="primary" disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save changes"}
          </Button>

          {dirty && !saving && (
            <Button
              variant="ghost"
              onClick={() => {
                setForm(initial);
                setProblem(null);
              }}
            >
              Discard
            </Button>
          )}

          {/* Confirmed rather than assumed. Nothing else on the page moves. */}
          {saved && !dirty && (
            <span className="rounded-full bg-mint-50 px-3 py-1 text-sm font-semibold text-mint-700">Saved.</span>
          )}
        </div>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  The part they may not                                              */
/* ------------------------------------------------------------------ */

/**
 * The documents HR holds about them, with the scan to download where one is
 * attached (H13). Read-only: HR records and verifies them.
 */
function YourDocuments({ record }: { record: PersonalRecord }) {
  const documents = record.documents ?? [];

  return (
    <Panel title="Your documents" subtitle="What HR holds on file for you." icon={FileText} hue="grape">
      {documents.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing on file. HR adds registrations, permits and certificates here.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{doc.title}</p>
                <p className="truncate text-xs text-neutral-500">
                  {doc.kindLabel}
                  {doc.expiresOn !== null ? ` · expires ${formatDate(doc.expiresOn)}` : ""}
                </p>
              </div>
              {doc.hasFile === true && (
                <a
                  href={hrm.me.documentFileUrl(doc.id)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-primary-500"
                  aria-label={`Download ${doc.title}`}
                >
                  <Download size={14} aria-hidden />
                  Download
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Shown, locked, with the reason.
 *
 * Leaving these off the page entirely would be tidier and worse. Somebody who
 * cannot find their date of birth assumes it was never recorded and raises a
 * ticket about it; somebody who can see it, greyed, with "payroll and
 * statutory filings depend on this" beside it, does not.
 */
function HeldAboutYou({ record }: { record: PersonalRecord }) {
  const locked: { label: string; value: string | null; icon: typeof Lock }[] = [
    { label: "Date of birth", value: formatDate(record.dateOfBirth), icon: Cake },
    { label: "Age", value: record.age === null ? null : String(record.age), icon: UserRound },
    { label: "Gender", value: record.gender, icon: Users },
    { label: "Nationality", value: record.nationality, icon: Flag },
    { label: "National ID", value: record.nationalId, icon: IdCard },
  ];

  return (
    <Panel
      title="Held about you"
      subtitle="Yours to see, not to change."
      icon={Lock}
      hue="grape"
      actions={
        <Chip hue="slate" icon={Lock}>
          HR only
        </Chip>
      }
    >
      <div className="divide-y divide-neutral-100">
        {locked.map((row) => (
          <InfoRow
            key={row.label}
            icon={row.icon}
            label={row.label}
            hue="grape"
            value={row.value !== null && row.value !== "" ? row.value : "—"}
          />
        ))}
      </div>

      <p className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
        These are terms of employment and identity facts that payroll and
        statutory filings depend on. If one is wrong, ask HR to correct it —
        they will have to see evidence.
      </p>
    </Panel>
  );
}

/**
 * Who we would ring.
 *
 * Read-only: there is no self-service route for contacts, and inventing a
 * client-side "edit" that quietly fails would be worse than saying so. What
 * the page can do is make it obvious when there is nobody recorded, which is
 * the state that matters on the worst day this module has.
 */
function EmergencyContacts({ record }: { record: PersonalRecord }) {
  if (record.emergencyContacts.length === 0) {
    return (
      <Panel title="In an emergency" icon={PhoneCall} hue="rose">
        <Empty
          icon={PhoneCall}
          hue="rose"
          title="Nobody recorded"
          hint="Ask HR to add somebody to ring. A name and a number is enough."
        />
      </Panel>
    );
  }

  const numbers = (c: EmergencyContact) =>
    [c.phone, c.alternatePhone].filter((n) => n !== null && n !== "").join(" · ");

  return (
    <section aria-labelledby="emergency-heading">
      <div className="mb-3">
        <h2 id="emergency-heading" className="text-[15px] font-semibold text-neutral-900">
          In an emergency
        </h2>
        <p className="text-xs text-neutral-500">Who we would ring. Ask HR to change any of this.</p>
      </div>
      <DataView<EmergencyContact>
        rows={record.emergencyContacts}
        rowKey={(c) => c.id}
        storageKey="hrm.me.contacts"
        caption="Your emergency contacts"
        searchable={false}
        defaultView="list"
        gridCols={2}
        columns={[
          {
            key: "name",
            header: "Name",
            primary: true,
            sortable: true,
            value: (c) => c.name,
            render: (c) => (
              <span className="flex items-center gap-3">
                <DecorAvatar name={c.name} size={32} />
                <span className="font-semibold text-neutral-900">{c.name}</span>
              </span>
            ),
          },
          { key: "relationship", header: "Relationship", sortable: true, value: (c) => c.relationship },
          {
            key: "phone",
            header: "Numbers",
            value: (c) => numbers(c),
            render: (c) => <span className="tabular-nums">{numbers(c)}</span>,
          },
          {
            key: "primary",
            header: "Order",
            value: (c) => (c.isPrimary ? "First call" : ""),
            render: (c) =>
              c.isPrimary ? (
                <Chip hue="mint" dot>
                  First call
                </Chip>
              ) : (
                <span className="text-neutral-400">—</span>
              ),
          },
        ]}
        renderListItem={(c) => (
          <div className="flex items-center gap-3 px-4 py-3">
            <DecorAvatar name={c.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{c.name}</p>
              <p className="truncate text-xs text-neutral-500">
                {[c.relationship, numbers(c)].filter((v) => v !== null && v !== "").join(" · ")}
              </p>
            </div>
            {c.isPrimary && (
              <Chip hue="mint" dot>
                First call
              </Chip>
            )}
          </div>
        )}
        renderCard={(c) => (
          <div className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <DecorAvatar name={c.name} size={44} />
              {c.isPrimary && (
                <Chip hue="mint" dot>
                  First call
                </Chip>
              )}
            </div>
            <div>
              <p className="text-[15px] font-semibold text-neutral-900">{c.name}</p>
              <p className="text-xs text-neutral-500">{c.relationship ?? "Relationship not given"}</p>
            </div>
            <p className="mt-auto flex items-center gap-1.5 text-sm tabular-nums text-neutral-700">
              <PhoneCall size={14} className="text-neutral-400" aria-hidden />
              {numbers(c)}
            </p>
            {c.email && (
              <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                <Mail size={13} aria-hidden />
                {c.email}
              </p>
            )}
          </div>
        )}
      />
    </section>
  );
}
