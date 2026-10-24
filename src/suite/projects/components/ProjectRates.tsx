"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeDollarSign, BookOpen, Plus, Trash2, UserRoundCog } from "lucide-react";
import { Button, ButtonLink, Chip, Panel, cx, initialsOf } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import {
  ApiError,
  rates as ratesApi,
  type EffectiveRate,
  type Project,
  type ProjectRate,
} from "@/lib/api/projects-client";
import { rate as rateLabel, toMajor, toMinor } from "./money";
import { Notice, Skeleton, hintCls, inputCls, labelCls, sayJobTitle } from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * What this project pays per hour, and how to change it.
 *
 * **The three-level chain was unreachable at the project level before this.**
 * The API had always accepted a project override and a person's own rate, the
 * resolver had always preferred them, and nothing could set one, so an
 * agency whose client pays above the card had no way to say so, and every
 * figure on that engagement was wrong by the difference.
 *
 * **Three things are shown at once, deliberately.** What each job title
 * *resolves* to, which rule produced it, and the overrides on this project. A
 * screen showing only the overrides would read as though nothing were set,
 * because most job titles will have none and fall through to the card.
 */
export default function ProjectRates({ project }: { project: Project }) {
  const confirm = useConfirm();
  const [overrides, setOverrides] = useState<ProjectRate[] | null>(null);
  const [effective, setEffective] = useState<EffectiveRate[]>([]);
  const [members, setMembers] = useState<
    { userId: string; name: string | null; disciplineId: string | null }[]
  >([]);
  const [canManage, setCanManage] = useState(false);
  const [currency, setCurrency] = useState(project.currency);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [adding, setAdding] = useState(false);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    ratesApi
      .forProject(project.slug)
      .then((res) => {
        if (cancelled) return;

        setOverrides(res.data);
        setEffective(res.meta.effective);
        setMembers(res.meta.members);
        setCanManage(res.meta.canManage);
        setCurrency(res.meta.projectCurrency);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "The rates did not load.");
        setOverrides([]);
      });

    return () => {
      cancelled = true;
    };
  }, [project.slug, reloads]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);

    try {
      await action();
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  /* An override removed falls back to the organisation's rate card. */
  const removeRate = async (id: string, title: string) => {
    const ok = await confirm({
      title,
      body: "This project falls back to the organisation's rate card. The override moves to the organisation's recycle bin, where an admin can restore it.",
      confirmLabel: "Remove rate",
      recoverable: true,
    });
    if (ok) await run(`del-${id}`, () => ratesApi.remove(id));
  };

  if (overrides === null) {
    return <Skeleton className="h-48" />;
  }

  const personal = overrides.filter((o) => o.userId !== null);

  const columns: Column<EffectiveRate>[] = [
    {
      key: "discipline",
      header: "Job title",
      primary: true,
      sortable: true,
      value: (row) => row.label,
      render: (row) => (
        <span className="flex items-center gap-2.5">
          <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HUE[hueFor(row.label)].dot)} aria-hidden />
          <span className="font-semibold text-neutral-900">{row.label}</span>
        </span>
      ),
    },
    {
      key: "rate",
      header: "Per hour",
      align: "right",
      sortable: true,
      value: (row) => row.rateMinor,
      render: (row) =>
        row.rateMinor === null ? (
          /* A visible gap gets filled; a plausible zero does not. */
          <Chip hue="sun" dot>
            No rate set
          </Chip>
        ) : (
          <span className="font-semibold tabular-nums text-neutral-900">{rateLabel(row.rateMinor, row.currency)}</span>
        ),
    },
    {
      /* Which of the six rules produced it. */
      key: "source",
      header: "Set by",
      hideOnMobile: true,
      value: (row) => (row.rateMinor === null ? "" : sayJobTitle(row.sourceLabel)),
      render: (row) =>
        row.rateMinor === null ? null : <Chip hue={sourceHue(row.source)}>{sayJobTitle(row.sourceLabel)}</Chip>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            tableOnly: true,
            render: (row: EffectiveRate) => {
              const override = overrideFor(row);
              return override === undefined ? null : (
                <RemoveButton
                  label={`Remove this project's ${row.label} override`}
                  disabled={busy !== null}
                  onClick={() => void removeRate(override.id, `Remove this project's ${row.label} override?`)}
                />
              );
            },
          },
        ]
      : []),
  ];

  function overrideFor(row: EffectiveRate): ProjectRate | undefined {
    return overrides?.find((o) => o.disciplineId === row.disciplineId && o.userId === null);
  }

  const personName = (row: ProjectRate) =>
    row.user ?? members.find((m) => m.userId === row.userId)?.name ?? "Somebody on this project";

  const personColumns: Column<ProjectRate>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      sortable: true,
      value: (row) => personName(row),
      render: (row) => (
        <span className="flex items-center gap-2.5">
          {/* Initials only: the name beside it is what a screen reader reads. */}
          <span
            aria-hidden
            className={cx("flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", HUE[hueFor(personName(row))].soft)}
          >
            {initialsOf(personName(row))}
          </span>
          <span className="font-semibold text-neutral-900">{personName(row)}</span>
        </span>
      ),
    },
    {
      key: "rate",
      header: "Per hour",
      align: "right",
      sortable: true,
      value: (row) => row.rateMinor,
      render: (row) => (
        <span className="font-semibold tabular-nums text-neutral-900">{rateLabel(row.rateMinor, row.currency)}</span>
      ),
    },
    { key: "note", header: "Note", hideOnMobile: true, value: (row) => row.note ?? "" },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            tableOnly: true,
            render: (row: ProjectRate) => (
              <RemoveButton
                label={`Remove ${row.user ?? "their"} rate on this project`}
                disabled={busy !== null}
                onClick={() => void removeRate(row.id, `Remove ${row.user ?? "their"} rate on this project?`)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {error !== null && <Notice tone="error">{error}</Notice>}

      <Panel
        title="Rates on this project"
        subtitle="What each job title resolves to, and which rule set it. An override here beats the card."
        icon={BadgeDollarSign}
        hue="mint"
        actions={
          canManage && (
            <>
              <ButtonLink href="/suite/projects/rates" variant="ghost" size="sm" icon={BookOpen}>
                The card
              </ButtonLink>
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
                Override a rate
              </Button>
            </>
          )
        }
      >
        {adding && (
          <OverrideForm
            effective={effective}
            members={members}
            currency={currency}
            busy={busy === "add"}
            onCancel={() => setAdding(false)}
            onSubmit={async (input) => {
              await run("add", () => ratesApi.setForProject(project.slug, input));
              setAdding(false);
            }}
          />
        )}

        <DataView
          rows={effective}
          columns={columns}
          rowKey={(row) => row.disciplineId}
          storageKey="projects.rates.disciplines"
          caption="The rate each job title resolves to on this project"
          searchable={effective.length > 6}
          searchPlaceholder="Search job titles"
          renderCard={(row) => {
            const override = overrideFor(row);
            return (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2.5">
                    <span className={cx("h-2.5 w-2.5 rounded-full", HUE[hueFor(row.label)].dot)} aria-hidden />
                    <span className="text-[15px] font-semibold text-neutral-900">{row.label}</span>
                  </span>
                  {canManage && override !== undefined && (
                    <RemoveButton
                      label={`Remove this project's ${row.label} override`}
                      disabled={busy !== null}
                      onClick={() => void removeRate(override.id, `Remove this project's ${row.label} override?`)}
                    />
                  )}
                </div>
                {row.rateMinor === null ? (
                  <Chip hue="sun" dot className="self-start">
                    No rate set
                  </Chip>
                ) : (
                  <>
                    <p className="text-2xl font-bold tracking-tight tabular-nums text-neutral-900">
                      {rateLabel(row.rateMinor, row.currency)}
                    </p>
                    <Chip hue={sourceHue(row.source)} className="self-start">
                      {sayJobTitle(row.sourceLabel)}
                    </Chip>
                  </>
                )}
              </div>
            );
          }}
          empty={
            <p className="px-5 py-10 text-center text-sm text-neutral-500">
              No job titles are set up yet, so there is nothing to price.
            </p>
          }
        />

        {/*
          A person's own rate, a contractor's number, listed apart from the
          job titles because it is a different rule and beats all of them.
        */}
        {personal.length > 0 && (
          <div className="mt-6 border-t border-neutral-100 pt-5">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <UserRoundCog size={14} aria-hidden />
              People with their own rate here
            </p>
            <DataView
              rows={personal}
              columns={personColumns}
              rowKey={(row) => row.id}
              storageKey="projects.rates.people"
              caption="People with their own rate on this project"
              searchable={false}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** An override on this project reads differently from the card it beats. */
function sourceHue(source: EffectiveRate["source"]): Hue {
  const s = String(source);
  if (s.startsWith("project")) return "grape";
  if (s.startsWith("user") || s.includes("person")) return "sky";
  return "slate";
}

function RemoveButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title="Falls back to the card"
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 size={15} aria-hidden />
    </button>
  );
}

/**
 * Setting an override.
 *
 * A job title **or** a person, never both, a person's own rate already beats
 * their job title's, so naming both is two rules pretending to be one, and the
 * API refuses it. The form makes that structural rather than leaving somebody
 * to discover it through a 422.
 */
function OverrideForm({
  effective,
  members,
  currency,
  busy,
  onCancel,
  onSubmit,
}: {
  effective: EffectiveRate[];
  members: { userId: string; name: string | null; disciplineId: string | null }[];
  currency: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    rateMinor: number;
    currency: string;
    disciplineId?: string | null;
    userId?: string | null;
    note?: string;
  }) => Promise<void>;
}) {
  const [target, setTarget] = useState<"discipline" | "person">("discipline");
  const [disciplineId, setDisciplineId] = useState(effective[0]?.disciplineId ?? "");
  const [userId, setUserId] = useState(members[0]?.userId ?? "");
  const [amount, setAmount] = useState(toMajor(effective[0]?.rateMinor ?? 2000));
  const [rateCurrency, setRateCurrency] = useState(currency);
  const [note, setNote] = useState("");

  const minor = toMinor(amount);
  const valid = minor > 0 && (target === "discipline" ? disciplineId !== "" : userId !== "");

  return (
    <div className="mb-5 grid gap-4 rounded-2xl border border-primary-100 bg-primary-50/40 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label htmlFor="pr-target" className={labelCls}>
          Override for
        </label>
        <SearchableSelect
          id="pr-target"
          value={target}
          onChange={(value) => setTarget(value as "discipline" | "person")}
          options={[
            { value: "discipline", label: "A job title" },
            { value: "person", label: "One person" },
          ]}
        />
      </div>

      {target === "discipline" ? (
        <div>
          <label htmlFor="pr-discipline" className={labelCls}>
            Job title
          </label>
          <JobTitlePicker
            id="pr-discipline"
            mode="id"
            value={disciplineId}
            onChange={(value) => setDisciplineId(value)}
            required
          />
        </div>
      ) : (
        <div>
          <label htmlFor="pr-person" className={labelCls}>
            Person
          </label>
          <SearchableSelect
            id="pr-person"
            value={userId}
            onChange={setUserId}
            searchPlaceholder="Search people"
            options={members.map((member) => ({
              value: member.userId,
              label: member.name ?? "Somebody on this project",
            }))}
          />
          <p className={hintCls}>Beats their job title&apos;s rate.</p>
        </div>
      )}

      <div>
        <label htmlFor="pr-amount" className={labelCls}>
          Per hour
        </label>
        <input
          id="pr-amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="pr-currency" className={labelCls}>
          Currency
        </label>
        <SearchableSelect
          id="pr-currency"
          value={rateCurrency}
          onChange={setRateCurrency}
          searchPlaceholder="Search currencies"
          options={[
            { value: "USD", label: "$ US dollar" },
            { value: "NGN", label: "₦ Naira" },
          ]}
        />
        {rateCurrency !== currency && (
          /* Said before it bites, rather than as a 422 when somebody logs an hour. */
          <p className="mt-1.5 text-xs font-medium text-sun-700">
            This project is in {currency}. An exchange rate has to exist or time
            cannot be logged.
          </p>
        )}
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <label htmlFor="pr-note" className={labelCls}>
          Note
        </label>
        <input
          id="pr-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Agreed in the statement of work"
          className={inputCls}
        />
      </div>

      <div className="flex items-end gap-2">
        <Button
          variant="primary"
          onClick={() =>
            void onSubmit({
              rateMinor: minor,
              currency: rateCurrency,
              /* One or the other, never both, see the form's docblock. */
              disciplineId: target === "discipline" ? disciplineId : null,
              userId: target === "person" ? userId : null,
              note: note.trim() === "" ? undefined : note.trim(),
            })
          }
          disabled={busy || !valid}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
