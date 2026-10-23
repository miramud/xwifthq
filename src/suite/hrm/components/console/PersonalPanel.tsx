"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileText,
  Paperclip,
  FileWarning,
  IdCard,
  PhoneCall,
  Plus,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { Button, Chip, Empty, Panel, PersonAvatar, buttonClass, cx } from "@/components/workspace/kit";
import { IconTile } from "../ui/recordKit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  hrm,
  type DocumentKind,
  type EmployeeDocument,
  type PersonalRecord,
  type EmergencyContact,
} from "@/lib/api/hrm-client";
import {
  Dialog,
  ErrorNote,
  Field,
  FormActions,
  INPUT,
  useSubmit,
} from "./Dialog";
import { formatDate } from "@/suite/hrm/lib/format";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * The person, as opposed to the post.
 *
 * Kept off the main employment record on purpose. A job title is visible to
 * anybody who can see the org chart; a home address, a date of birth and a next
 * of kin are held because employing somebody requires them, and the list of
 * people who need to read them is much shorter. One component, one request, one
 * thing to gate.
 *
 * The emergency contact is first and unmissable. Somebody looking it up is not
 * browsing — it is the worst day the module has, and a number that takes three
 * clicks to find is a number nobody finds.
 */
export default function PersonalPanel({ employeeId }: { employeeId: string }) {
  const confirm = useConfirm();
  const [record, setRecord] = useState<PersonalRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<"contact" | "document" | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(
    null,
  );
  const [removing, setRemoving] = useState<string | null>(null);

  const removeContact = async (contactId: string) => {
    const contact = record?.emergencyContacts.find((c) => c.id === contactId);
    const ok = await confirm({
      title: contact ? `Remove ${contact.name} as an emergency contact?` : "Remove this emergency contact?",
      body: "Nobody will find them here in an emergency. They move to the organisation's recycle bin, where an admin can restore them.",
      confirmLabel: "Remove contact",
      recoverable: true,
    });
    if (!ok) return;
    setRemoving(contactId);

    try {
      await hrm.employees.removeContact(contactId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not save.");
    } finally {
      setRemoving(null);
    }
  };

  const load = useCallback(async () => {
    try {
      // Awaited into a const before any setState, which is the shape the
      // React 19 lint rule wants: `setRecord(await …)` reads to it as a
      // synchronous call in an effect body.
      const result = await hrm.employees.personal(employeeId);

      setRecord(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not load.");
    }
  }, [employeeId]);

  /*
    The promise form rather than `void load()`, and a cancellation flag with
    it. Navigating away from a record mid-fetch would otherwise set state on an
    unmounted component, which is the one thing this panel can do that the
    record above it cannot recover from.
  */
  useEffect(() => {
    let cancelled = false;

    hrm.employees
      .personal(employeeId)
      .then((result) => {
        if (!cancelled) setRecord(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (error !== null && record === null) {
    return (
      <Panel title="Personal details" icon={IdCard} hue="sky">
        <Empty icon={AlertTriangle} hue="coral" title="Could not load" hint={error} />
      </Panel>
    );
  }

  if (record === null) {
    return (
      <div
        aria-hidden
        className="ws-card h-48 animate-pulse bg-neutral-50"
      />
    );
  }

  const primary = record.emergencyContacts.find((c) => c.isPrimary)
    ?? record.emergencyContacts[0];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      {/* --------------------------- who to ring -------------------- */}

      <Panel
        title="In an emergency"
        icon={Siren}
        hue="rose"
        subtitle="Who to ring, and what they are to this person."
        actions={
          <button
            type="button"
            onClick={() => setAdding("contact")}
            /*
              Named for what it adds. Two buttons both reading "Add" on one
              screen is ambiguous to anybody navigating by landmark or label,
              and the visible text stays short.
            */
            aria-label="Add a contact"
            className={buttonClass("secondary", "sm")}
          >
            <Plus size={15} aria-hidden />
            Add
          </button>
        }
      >
        {primary === undefined ? (
          /*
            Said as a gap to close rather than shown as a blank. An institution
            that cannot say who to ring when somebody collapses on a night
            shift has a problem no amount of payroll accuracy makes up for.
          */
          <div className="flex items-start gap-3 rounded-xl bg-sun-50 px-3 py-3">
            <PhoneCall size={15} className="mt-0.5 shrink-0 text-sun-700" aria-hidden />
            <p className="text-sm font-medium text-sun-700">
              Nobody is recorded for this person. Ask them for a name and a
              number — those two are enough.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {record.emergencyContacts.map((contact) => (
              <li
                key={contact.id}
                className={cx(
                  "flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-3",
                  contact.isPrimary ? "border-rose-100 bg-rose-50/50" : "border-neutral-100 bg-neutral-50/60",
                )}
              >
                <PersonAvatar name={contact.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
                    {contact.name}
                    {contact.isPrimary && <Chip hue="mint" dot>Ring first</Chip>}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {contact.relationship ?? "Relationship not recorded"}
                  </p>
                </div>
                <a
                  href={`tel:${contact.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center rounded-lg bg-white px-2.5 py-1.5 text-sm font-semibold tabular-nums text-primary-700 shadow-sm hover:text-primary-800"
                >
                  {contact.phone}
                </a>

                <button
                  type="button"
                  onClick={() => setEditingContact(contact)}
                  aria-label={`Edit ${contact.name}`}
                  className={buttonClass("ghost", "sm")}
                >
                  Edit
                </button>

                {/*
                  Only ever offered when somebody else is left. Removing the
                  last contact leaves nobody to ring when this person collapses
                  on a night shift, and an empty list reads as "not asked yet"
                  rather than "deliberately removed".
                */}
                {record.emergencyContacts.length > 1 && (
                  <button
                    type="button"
                    disabled={removing === contact.id}
                    onClick={() => void removeContact(contact.id)}
                    aria-label={`Remove ${contact.name}`}
                    className={cx(buttonClass("ghost", "sm"), "text-error-700 hover:bg-error-500/10 hover:text-error-700")}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* --------------------------- documents ----------------------- */}

      <Documents
        record={record}
        onAdd={() => setAdding("document")}
        onChanged={load}
      />

      {/* -------------------------- the details ---------------------- */}

      <Panel
        className="lg:col-span-2"
        title="Personal details"
        icon={IdCard}
        hue="sky"
        actions={
          <Button size="sm" onClick={() => setEditingDetails(true)} aria-label="Edit personal details">
            Edit
          </Button>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            label="Date of birth"
            value={
              record.dateOfBirth === null
                ? "—"
                : `${formatDate(record.dateOfBirth)}${record.age !== null ? ` · ${record.age}` : ""}`
            }
          />
          <Fact label="Gender" value={record.gender ?? "—"} />
          <Fact label="Marital status" value={record.maritalStatus ?? "—"} />
          <Fact label="Nationality" value={record.nationality ?? "—"} />
          <Fact label="National ID" value={record.nationalId ?? "—"} />
          <Fact label="Personal phone" value={record.personalPhone ?? "—"} />
        </dl>

        <div className="mt-3 grid gap-3">
          <Fact label="Address" value={record.postalAddress ?? "—"} />
          {/*
            The work address stops answering the day somebody leaves, which is
            exactly the day a final payslip needs to reach them.
          */}
          <p className="text-xs text-neutral-500">
            Personal email: {record.personalEmail ?? "not recorded"}
          </p>
        </div>
      </Panel>

      {editingDetails && (
        <EditDetailsDialog
          employeeId={employeeId}
          record={record}
          onClose={() => setEditingDetails(false)}
          onSaved={() => {
            setEditingDetails(false);
            void load();
          }}
        />
      )}

      {editingContact !== null && (
        <EditContactDialog
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSaved={() => {
            setEditingContact(null);
            void load();
          }}
        />
      )}

      {adding === "contact" && (
        <AddContactDialog
          employeeId={employeeId}
          onClose={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            void load();
          }}
        />
      )}

      {adding === "document" && (
        <AddDocumentDialog
          employeeId={employeeId}
          onClose={() => setAdding(null)}
          onAdded={() => {
            setAdding(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

/**
 * Editing the person, as opposed to the post.
 *
 * Everything here is somebody's private life, so the panel showed it and had
 * no way to correct it — which in practice means the record ages out and the
 * home address on file is the one from the day they were hired.
 *
 * Only the fields the API accepts, and no employment data: job title, salary
 * and department belong to the employment record and are changed there, under
 * a different audit trail.
 */
function EditDetailsDialog({
  employeeId,
  record,
  onClose,
  onSaved,
}: {
  employeeId: string;
  record: PersonalRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    dateOfBirth: record.dateOfBirth ?? "",
    gender: record.gender ?? "",
    maritalStatus: record.maritalStatus ?? "",
    nationality: record.nationality ?? "",
    nationalId: record.nationalId ?? "",
    addressLine1: record.addressLine1 ?? "",
    addressLine2: record.addressLine2 ?? "",
    city: record.city ?? "",
    state: record.state ?? "",
    postcode: record.postcode ?? "",
    country: record.country ?? "",
    personalEmail: record.personalEmail ?? "",
    personalPhone: record.personalPhone ?? "",
  });

  const { submit, saving, error } = useSubmit(onSaved);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog
      title="Personal details"
      subtitle="The person, not the post. Job title and pay are changed on the employment record."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.employees.savePersonal(
              employeeId,
              /*
                Empty strings become null rather than being sent as "". A
                cleared field means "we do not hold this", and an empty string
                is a value that sorts and matches like any other.
              */
              Object.fromEntries(
                Object.entries(form).map(([k, v]) => [k, v === "" ? null : v]),
              ),
            ),
          )
        }
        className="space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="pd-dob" label="Date of birth">
            <input
              id="pd-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth")(e.target.value)}
              className={INPUT}
            />
          </Field>

          <Field id="pd-gender" label="Gender">
            <input
              id="pd-gender"
              value={form.gender}
              onChange={(e) => set("gender")(e.target.value)}
              maxLength={32}
              className={INPUT}
            />
          </Field>

          <Field id="pd-marital" label="Marital status">
            <input
              id="pd-marital"
              value={form.maritalStatus}
              onChange={(e) => set("maritalStatus")(e.target.value)}
              maxLength={24}
              className={INPUT}
            />
          </Field>

          <Field id="pd-nationality" label="Nationality">
            <input
              id="pd-nationality"
              value={form.nationality}
              onChange={(e) => set("nationality")(e.target.value)}
              maxLength={64}
              className={INPUT}
            />
          </Field>

          <Field id="pd-national-id" label="National ID">
            <input
              id="pd-national-id"
              value={form.nationalId}
              onChange={(e) => set("nationalId")(e.target.value)}
              maxLength={64}
              className={INPUT}
            />
          </Field>

          <Field
            id="pd-phone"
            label="Personal phone"
            hint="The number that still works after they leave."
          >
            <input
              id="pd-phone"
              aria-describedby="pd-phone-hint"
              value={form.personalPhone}
              onChange={(e) => set("personalPhone")(e.target.value)}
              maxLength={32}
              className={INPUT}
            />
          </Field>
        </div>

        {/*
          The work address stops answering the day somebody leaves, which is
          exactly the day a final payslip and a P45 have to reach them.
        */}
        <Field
          id="pd-email"
          label="Personal email"
          hint="Not the work address — that stops answering the day they leave."
        >
          <input
            id="pd-email"
            type="email"
            aria-describedby="pd-email-hint"
            value={form.personalEmail}
            onChange={(e) => set("personalEmail")(e.target.value)}
            maxLength={255}
            className={INPUT}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="pd-address1" label="Address" className="sm:col-span-2">
            <input
              id="pd-address1"
              value={form.addressLine1}
              onChange={(e) => set("addressLine1")(e.target.value)}
              maxLength={255}
              className={INPUT}
            />
          </Field>

          <Field id="pd-address2" label="Address line 2" className="sm:col-span-2">
            <input
              id="pd-address2"
              value={form.addressLine2}
              onChange={(e) => set("addressLine2")(e.target.value)}
              maxLength={255}
              className={INPUT}
            />
          </Field>

          <Field id="pd-city" label="City">
            <input
              id="pd-city"
              value={form.city}
              onChange={(e) => set("city")(e.target.value)}
              maxLength={96}
              className={INPUT}
            />
          </Field>

          <Field id="pd-state" label="State">
            <input
              id="pd-state"
              value={form.state}
              onChange={(e) => set("state")(e.target.value)}
              maxLength={96}
              className={INPUT}
            />
          </Field>

          <Field id="pd-postcode" label="Postcode">
            <input
              id="pd-postcode"
              value={form.postcode}
              onChange={(e) => set("postcode")(e.target.value)}
              maxLength={24}
              className={INPUT}
            />
          </Field>

          <Field id="pd-country" label="Country">
            <input
              id="pd-country"
              value={form.country}
              onChange={(e) => set("country")(e.target.value)}
              maxLength={64}
              className={INPUT}
            />
          </Field>
        </div>

        <ErrorNote error={error} />
        <FormActions onCancel={onClose} submitLabel="Save" saving={saving} />
      </form>
    </Dialog>
  );
}

/**
 * Correcting an emergency contact.
 *
 * A number that has changed is worse than no number: somebody rings it at
 * three in the morning, gets a disconnected tone, and has nothing else to try.
 */
function EditContactDialog({
  contact,
  onClose,
  onSaved,
}: {
  contact: EmergencyContact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(contact.name);
  const [relationship, setRelationship] = useState(contact.relationship ?? "");
  const [phone, setPhone] = useState(contact.phone);
  const [isPrimary, setIsPrimary] = useState(contact.isPrimary);
  const { submit, saving, error } = useSubmit(onSaved);

  return (
    <Dialog title="Edit contact" subtitle={contact.name} onClose={onClose}>
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.employees.updateContact(contact.id, {
              name,
              relationship: relationship === "" ? null : relationship,
              phone,
              isPrimary,
            }),
          )
        }
        className="space-y-3"
      >
        <Field id="ec-name" label="Name">
          <input
            id="ec-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={INPUT}
          />
        </Field>

        <Field id="ec-relationship" label="Relationship">
          <input
            id="ec-relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field
          id="ec-phone"
          label="Phone"
          hint="A number nobody has checked in three years is worse than none — it gets rung at 3am and answers with a disconnected tone."
        >
          <input
            id="ec-phone"
            aria-describedby="ec-phone-hint"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className={INPUT}
          />
        </Field>

        <div className="flex items-start gap-2 rounded-xl border border-neutral-200 px-3 py-2.5">
          <input
            id="ec-primary"
            type="checkbox"
            aria-describedby="ec-primary-hint"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="mt-0.5"
            disabled={contact.isPrimary}
          />
          <div>
            <label htmlFor="ec-primary" className="text-xs text-neutral-700">
              Ring this one first
            </label>
            <p id="ec-primary-hint" className="mt-0.5 text-[11px] text-neutral-500">
              {contact.isPrimary
                ? "Already first. Make another contact primary to move it."
                : "Whoever is first now stops being first."}
            </p>
          </div>
        </div>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Save"
          saving={saving}
          disabled={name.trim() === "" || phone.trim() === ""}
        />
      </form>
    </Dialog>
  );
}

/**
 * Documents, ordered by how soon they become a problem.
 *
 * The expiry is the point rather than the file. Knowing that a ward sister's
 * registration lapses in March is an operational fact the roster has to
 * respect, and it is true whether or not anybody uploaded a scan.
 */
export function Documents({
  record,
  onAdd,
  onChanged,
}: {
  record: PersonalRecord;
  onAdd: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const confirm = useConfirm();

  const remove = async (id: string) => {
    const doc = record.documents.find((d) => d.id === id);
    const ok = await confirm({
      title: doc ? `Remove “${doc.title}”?` : "Remove this document?",
      body: "Its expiry stops being tracked, and a roster that depends on it may block. It moves to the organisation's recycle bin, where an admin can restore it.",
      confirmLabel: "Remove document",
      recoverable: true,
    });
    if (!ok) return;

    setBusy(id);

    try {
      await hrm.employees.removeDocument(id);
      onChanged();
    } catch {
      /* The document stays listed, which is the safe reading of a failure. */
    } finally {
      setBusy(null);
    }
  };

  /** Attach, or replace, the scan on a document already recorded (H13). */
  const attach = async (id: string, file: File) => {
    setBusy(id);
    setFileError(null);
    try {
      await hrm.employees.attachDocumentFile(id, file);
      onChanged();
    } catch (e) {
      setFileError(e instanceof ApiError ? e.message : "That file could not be uploaded.");
    } finally {
      setBusy(null);
    }
  };

  const verify = async (id: string) => {
    setBusy(id);
    try {
      await hrm.employees.verifyDocument(id);
      onChanged();
    } catch {
      // A verification that did not save leaves the document unverified,
      // which is the safe reading of it anyway.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Documents"
      icon={FileText}
      hue={record.isBlockedByDocument ? "coral" : "grape"}
      subtitle={
        record.isBlockedByDocument
          ? "Something has lapsed that stops this person working."
          : "Registrations, permits and clearances."
      }
      actions={
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add a document"
          className={buttonClass("secondary", "sm")}
        >
          <Plus size={15} aria-hidden />
          Add
        </button>
      }
      bodyClassName={record.documents.length === 0 ? "p-5" : "pb-2"}
    >
      {record.isBlockedByDocument && (
        <div className="mx-5 mt-5 flex items-start gap-3 rounded-xl bg-error-500/10 px-3 py-2.5">
          <FileWarning size={15} className="mt-0.5 shrink-0 text-error-700" aria-hidden />
          <p className="text-sm text-error-700">
            This person should not be rostered until it is renewed.
          </p>
        </div>
      )}

      {fileError !== null && (
        <p role="alert" className="mx-5 mt-4 rounded-xl bg-error-500/10 px-3 py-2 text-sm text-error-700">
          {fileError}
        </p>
      )}

      {record.documents.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing recorded. An expiry is worth adding even without a scan.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100">
          {record.documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <IconTile icon={FileText} hue={doc.hasExpired ? "coral" : doc.needsRenewing ? "sun" : "grape"} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {doc.title}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {doc.kindLabel}
                  {doc.issuer !== null ? ` · ${doc.issuer}` : ""}
                </p>
              </div>

              <ExpiryPill document={doc} />

              {doc.hasFile === true ? (
                <a
                  href={hrm.employees.documentFileUrl(doc.id)}
                  aria-label={`Download the scan of ${doc.title}`}
                  title={doc.fileName ?? undefined}
                  className={buttonClass("secondary", "sm")}
                >
                  <Download size={14} aria-hidden />
                  Scan
                </a>
              ) : (
                <label
                  className={cx(buttonClass("ghost", "sm"), "cursor-pointer focus-within:outline-2 focus-within:outline-primary-500")}
                  title="Attach a PDF or a photo of it"
                >
                  <Paperclip size={14} aria-hidden />
                  Attach scan
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
                    className="sr-only"
                    disabled={busy === doc.id}
                    aria-label={`Attach a scan of ${doc.title}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void attach(doc.id, file);
                    }}
                  />
                </label>
              )}

              {doc.isVerified ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-mint-50 px-2.5 py-1 text-xs font-semibold text-mint-700"
                  title="Somebody has looked at this"
                >
                  <ShieldCheck size={13} aria-hidden />
                  Verified
                </span>
              ) : (
                /*
                  Its own action rather than a field on the form: a date typed
                  from an email and a document an HR officer has seen are
                  different assurances.
                */
                <button
                  type="button"
                  disabled={busy === doc.id}
                  onClick={() => void verify(doc.id)}
                  className={buttonClass("secondary", "sm")}
                >
                  Verify
                </button>
              )}

              {/*
                For a document added in error or against the wrong person. A
                record that can only be added to accumulates duplicates, and a
                duplicate registration with a different expiry is worse than no
                record at all — the roster believes whichever it reads first.
              */}
              <button
                type="button"
                disabled={busy === doc.id}
                onClick={() => void remove(doc.id)}
                aria-label={`Remove ${doc.title}`}
                className={cx(buttonClass("ghost", "sm"), "text-error-700 hover:bg-error-500/10 hover:text-error-700")}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * How close this one is to being a problem.
 *
 * "Expired 40 days ago" and "expires in 40 days" are the two ends of one
 * scale, which is why the API returns a signed number and this renders both
 * halves rather than clamping at zero.
 */
export function ExpiryPill({ document: doc }: { document: EmployeeDocument }) {
  if (!doc.expires) {
    return <Chip hue="slate">No expiry</Chip>;
  }

  const days = doc.daysUntilExpiry ?? 0;

  if (doc.hasExpired) {
    return (
      <Chip hue={doc.blocksWork ? "coral" : "sun"} dot>
        Expired {Math.abs(days)}d ago
      </Chip>
    );
  }

  return (
    <Chip hue={doc.needsRenewing ? "sun" : "slate"} dot={doc.needsRenewing}>
      {days}d left
    </Chip>
  );
}

/* ------------------------------------------------------------------ */

export function AddContactDialog({
  employeeId,
  onClose,
  onAdded,
}: {
  employeeId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await hrm.employees.addContact(employeeId, {
        name,
        phone,
        relationship: relationship === "" ? null : relationship,
      });
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog title="Add an emergency contact" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {/*
          Only two fields are required, and the hint says why. A contact with a
          name and a number is useful on the worst day; one that was never
          recorded because the form wanted an address is not.
        */}
        <Field id="ac-name" label="Name" hint="Required.">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        </Field>

        <Field
          id="ac-phone"
          label="Phone"
          hint="Required. Everything else can follow later."
        >
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className={inputClass}
          />
        </Field>

        <Field id="ac-relationship" label="Relationship">
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Spouse, parent, friend…"
            className={inputClass}
          />
        </Field>

        {error !== null && (
          <p className="text-sm text-error-700">{error}</p>
        )}

        <FormActions onCancel={onClose} submitLabel="Add" saving={saving} />
      </form>
    </Dialog>
  );
}

const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: "certification", label: "Professional certification" },
  { value: "right_to_work", label: "Right to work" },
  { value: "identity", label: "Identity document" },
  { value: "qualification", label: "Qualification" },
  { value: "clearance", label: "Clearance check" },
  { value: "agreement", label: "Signed agreement" },
  { value: "other", label: "Other" },
];

export function AddDocumentDialog({
  employeeId,
  onClose,
  onAdded,
}: {
  employeeId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [kind, setKind] = useState<DocumentKind>("certification");
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await hrm.employees.addDocument(
        employeeId,
        {
          kind,
          title,
          issuer: issuer === "" ? null : issuer,
          // Empty means it does not expire, which is a real answer for a degree
          // certificate and has to be distinguishable from a forgotten field.
          expiresOn: expiresOn === "" ? null : expiresOn,
        },
        file,
      );
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  };

  const blocks = kind === "certification" || kind === "right_to_work" || kind === "clearance";

  return (
    <Dialog title="Add a document" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field id="ad-kind" label="What kind">
          <SearchableSelect
            id="ad-kind"
            value={kind}
            onChange={(v) => setKind(v as DocumentKind)}
            options={DOCUMENT_KINDS.map((option) => ({ value: option.value, label: option.label }))}
          />
        </Field>

        {blocks && (
          <p className="rounded-lg bg-warning-50 px-3 py-2 text-[11px] text-warning-800">
            Once this lapses, the person should not be rostered until it is
            renewed.
          </p>
        )}

        <Field id="ad-title" label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Nursing registration"
            className={inputClass}
          />
        </Field>

        <Field id="ad-issuer" label="Issued by">
          <input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          id="ad-expires"
          label="Expires on"
          hint="Leave empty if it never expires."
        >
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          id="ad-file"
          label="Scan"
          hint="Optional. A PDF or a photo, up to 10 MB. Only HR and the employee can download it."
        >
          <input
            id="ad-file"
            type="file"
            aria-describedby="ad-file-hint"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-200"
          />
        </Field>

        {error !== null && <p className="text-sm text-error-700">{error}</p>}

        <FormActions onCancel={onClose} submitLabel="Add" saving={saving} />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-neutral-50 px-3 py-2.5">
      <dt className="text-[11px] font-medium text-neutral-500">{label}</dt>
      <dd className="truncate text-sm font-semibold text-neutral-900">{value}</dd>
    </div>
  );
}
