"use client";

import { useRef, useState } from "react";
import { buttonClass } from "@/components/workspace/kit";
import { UserPlus, Upload, FileText, TriangleAlert, X, Download } from "lucide-react";
import {
  students as api,
  ApiError,
  type OneTimeCredential,
  type ImportResult,
} from "@/lib/api/saas-client";
import CredentialsDialog from "./CredentialsDialog";

/**
 * Adding learners to an institution — one at a time, or a file at a time.
 *
 * Both routes end at the same place: a set of generated passwords that exist
 * exactly once. `CredentialsDialog` owns that moment; this component's job is
 * to get there and to be honest about the file format on the way.
 *
 * The CSV contract is stated on the screen rather than in documentation
 * somebody has to go and find, because the commonest import failure is a file
 * shaped differently from what the importer expects.
 */
export default function AddStudentsPanel({
  open,
  mode,
  onClose,
  onAdded,
}: {
  open: boolean;
  mode: "single" | "bulk";
  onClose: () => void;
  onAdded: () => void;
}) {
  const [credentials, setCredentials] = useState<OneTimeCredential[] | null>(null);

  if (credentials) {
    return (
      <CredentialsDialog
        credentials={credentials}
        onClose={() => {
          setCredentials(null);
          onClose();
          onAdded();
        }}
      />
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain p-0 sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-neutral-900/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-students-title"
        className="relative mt-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.375rem] sm:mb-auto bg-white shadow-2xl sm:rounded-[1.375rem]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 p-5">
          <h2 id="add-students-title" className="text-lg font-semibold text-neutral-900">
            {mode === "single" ? "Add a learner" : "Import learners"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {mode === "single" ? (
          <SingleForm onDone={(c) => setCredentials(c)} />
        ) : (
          <BulkForm onDone={(c) => setCredentials(c)} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SingleForm({ onDone }: { onDone: (credentials: OneTimeCredential[]) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 1 && email.includes("@") && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    try {
      const result = await api.create({ name: name.trim(), email: email.trim().toLowerCase() });

      onDone([
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          temporaryPassword: result.temporaryPassword ?? "",
        },
      ]);
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Couldn't add that learner.");
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="space-y-5 p-5">
        <div>
          <label htmlFor="student-name" className="mb-2 block text-sm font-medium text-neutral-700">
            Full name <span className="text-error-500">*</span>
          </label>
          <input
            id="student-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            className="h-11 w-full rounded-xl border border-neutral-200 px-3.5 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
          />
        </div>

        <div>
          <label htmlFor="student-email" className="mb-2 block text-sm font-medium text-neutral-700">
            Email <span className="text-error-500">*</span>
          </label>
          <input
            id="student-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            autoComplete="off"
            aria-describedby="student-email-help"
            className="h-11 w-full rounded-xl border border-neutral-200 px-3.5 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
          />
          <p id="student-email-help" className="mt-1.5 text-xs text-neutral-500">
            This is how they sign in, and it cannot be changed later.
          </p>
        </div>

        <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-neutral-600">
          A password will be generated and shown to you once, on the next screen.
        </p>
      </div>

      <div className="border-t border-neutral-200 p-5">
        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-error-500/5 px-3 py-2.5 text-sm text-error-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className={`${buttonClass("primary")} w-full`}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {saving ? "Adding…" : "Add learner"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

const SAMPLE_CSV = "name,email\nAda Lovelace,ada@example.edu\nGrace Hopper,grace@example.edu";

function BulkForm({ onDone }: { onDone: (credentials: OneTimeCredential[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "xwifthq-learner-template.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || saving) return;

    setSaving(true);
    setError(null);

    try {
      const result = await api.import(file);

      // Rows can fail individually. Show the report first when any did, so the
      // admin sees what was skipped before the credentials take over the screen.
      if (result.errors.length > 0) {
        setReport(result);
        setSaving(false);
        return;
      }

      onDone(result.credentials);
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Couldn't read that file.");
    }
  }

  if (report) {
    return (
      <>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="mb-4 text-sm text-neutral-700">
            <strong className="text-mint-700">{report.created} added</strong>
            {" · "}
            <strong className="text-sun-700">{report.skipped} skipped</strong>
          </p>

          <h3 className="mb-2 text-sm font-medium text-neutral-700">Rows we could not use</h3>

          <ul className="space-y-2">
            {report.errors.map((row) => (
              <li
                key={`${row.line}-${row.email ?? ""}`}
                className="rounded-xl border border-sun-500/25 bg-sun-50 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-neutral-500">Line {row.line}</span>
                {row.email && <span className="ml-2 text-neutral-700">{row.email}</span>}
                <span className="mt-0.5 block text-xs text-neutral-600">{row.reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-neutral-200 p-5">
          <button
            type="button"
            onClick={() => onDone(report.credentials)}
            disabled={report.credentials.length === 0}
            className={`${buttonClass("primary")} w-full`}
          >
            {report.credentials.length > 0
              ? `Show the ${report.credentials.length} password${report.credentials.length === 1 ? "" : "s"}`
              : "Nothing was created"}
          </button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="space-y-5 p-5">
        {/* The format is stated here rather than in documentation, because a
            wrongly shaped file is the commonest way this fails. */}
        <div className="rounded-2xl border border-neutral-200 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <FileText className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            What the file should look like
          </h3>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-50 p-3 font-mono text-xs text-neutral-600">
            {SAMPLE_CSV}
          </pre>
          <p className="mt-2 text-xs text-neutral-500">
            Columns can be in either order, and the header row is optional. Up to 2,000 rows.
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download template
          </button>
        </div>

        <div>
          <label htmlFor="csv-file" className="mb-2 block text-sm font-medium text-neutral-700">
            Your file <span className="text-error-500">*</span>
          </label>
          <input
            ref={inputRef}
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-neutral-200 p-3 text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-warning-400/10 px-4 py-3 text-sm text-neutral-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
          Each learner gets a generated password, shown to you once on the next screen. There is no
          way to retrieve them afterwards.
        </p>
      </div>

      <div className="border-t border-neutral-200 p-5">
        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-error-500/5 px-3 py-2.5 text-sm text-error-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={!file || saving} className={`${buttonClass("primary")} w-full`}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {saving ? "Importing…" : "Import learners"}
        </button>
      </div>
    </form>
  );
}
