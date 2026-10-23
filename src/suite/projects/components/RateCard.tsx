"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  CalendarClock,
  Coins,
  Info,
  Layers,
  LockKeyhole,
  Plus,
  RotateCw,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  fx as fxApi,
  rates as ratesApi,
  type ExchangeRateRow,
  type ProjectRate,
} from "@/lib/api/projects-client";
import { rate as rateLabel, toMajor, toMinor } from "./money";
import { today } from "./dates";
import {
  Modal,
  Notice,
  SectionHeading,
  Skeleton,
  fmtDate,
  hintCls,
  inputCls,
  labelCls,
  sayJobTitle,
} from "./ui/pkit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * The institution's rate card and its exchange rates.
 *
 * **The $20 default is rows, not a fallback.** Opening this screen seeds one
 * rate per job title the first time. A default hidden inside the resolver is
 * one nobody knows is being applied; a row on a screen is one they can
 * disagree with — and disagreeing with it is the whole point of the screen.
 *
 * **Exchange rates are typed in and never guessed.** There is no default and no
 * feed. A wrong FX rate does not fail — it produces a plausible number somebody
 * quotes to a client, and on a ₦40m project the gap between 1,500 and 1,580 is
 * ₦2m of margin that never existed. The rate an agency invoices at is also the
 * one their bank gave them on the day, which is not the mid-market rate a feed
 * returns. So: a blank, a question, and ten seconds of somebody's time.
 *
 * A stale rate is flagged and still used. Refusing to convert would leave a gap
 * where a caveated number belongs, and a caveated number is more use than none.
 */

const whoOf = (row: ProjectRate) => row.user ?? row.discipline ?? "Everybody else";

export default function RateCard() {
  const confirm = useConfirm();
  const [card, setCard] = useState<ProjectRate[] | null>(null);
  const [disciplines, setDisciplines] = useState<{ id: string; key: string; label: string }[]>([]);
  const [defaults, setDefaults] = useState<{ minor: number; currency: string }>({
    minor: 2000,
    currency: "USD",
  });

  const [fxRates, setFxRates] = useState<ExchangeRateRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  /*
    Why the card could not be read at all. Kept apart from `error` (a failed
    save on a card that did load): an unreadable card used to be drawn as an
    empty one, with "Add a rate" and "Set an exchange rate" live on it for
    somebody the API had just refused.
  */
  const [unreadable, setUnreadable] = useState<{ refused: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const [adding, setAdding] = useState(false);
  const [settingFx, setSettingFx] = useState(false);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([ratesApi.card(), fxApi.list()])
      .then(([rateRes, fxRes]) => {
        if (cancelled) return;

        setCard(rateRes.data);
        setDisciplines(rateRes.meta.jobTitles ?? rateRes.meta.disciplines);
        setDefaults({
          minor: rateRes.meta.defaultMinor,
          currency: rateRes.meta.defaultCurrency,
        });
        setFxRates(fxRes.data);
        setError(null);
        setUnreadable(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setUnreadable({
          refused: e instanceof ApiError && e.status === 403,
          message: e instanceof ApiError ? e.message : "That did not load.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [reloads]);

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

  const header = (
    <PageHeader
      eyebrow="Projects · Settings"
      title="Rates"
      subtitle="What an hour costs, and what a naira is worth. A project can override any of these from its own Cost tab."
      actions={
        <>
          <Button icon={ArrowLeftRight} onClick={() => setSettingFx(true)}>
            Set an exchange rate
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add a rate
          </Button>
        </>
      }
    />
  );

  if (unreadable !== null) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Projects · Settings"
          title="Rates"
          subtitle="What an hour costs, and what a naira is worth."
        />
        <Panel>
          {unreadable.refused ? (
            /*
              Shown to everybody in the nav by design (see ProjectsShell), so
              the refusal says who keeps it and what is still theirs to do.
            */
            <Empty
              icon={LockKeyhole}
              hue="slate"
              title="Rates are kept by delivery leads"
              hint="The rate card shows what each colleague's hour costs, so only a delivery lead or an admin can open it. Ask a delivery lead if a rate looks wrong. You can still log your own hours on each project's Time tab."
            />
          ) : (
            <Empty
              icon={Info}
              hue="sun"
              title="The rate card did not load"
              hint={unreadable.message}
              action={
                <Button icon={RotateCw} onClick={reload}>
                  Try again
                </Button>
              }
            />
          )}
        </Panel>
      </div>
    );
  }

  if (card === null) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {header}
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[124px]" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const unpriced = disciplines.filter(
    (d) => !card.some((r) => r.disciplineId === d.id && r.userId === null),
  );
  /*
    The "Everybody else" row. The resolver takes the most specific row that
    matches, so with this on the card a job title with no rate of its own is
    priced at it - not free. Saying "cost nothing" beside it was wrong.
  */
  const fallback = card.find((r) => r.userId === null && r.disciplineId === null) ?? null;
  const personal = card.filter((r) => r.userId !== null).length;
  const stale = fxRates.filter((r) => r.isStale).length;

  const removeButton = (row: ProjectRate) => (
    <button
      type="button"
      onClick={async () => {
        const who = row.user ?? row.discipline ?? "everybody else";
        const ok = await confirm({
          title: `Remove the rate for ${who}?`,
          body: "The next rate that applies takes over. This one moves to the organisation's recycle bin, where an admin can restore it.",
          confirmLabel: "Remove rate",
          recoverable: true,
        });
        if (ok) await run(`del-${row.id}`, () => ratesApi.remove(row.id));
      }}
      disabled={busy !== null}
      aria-label={`Remove the rate for ${row.user ?? row.discipline ?? "everybody else"}`}
      title="Remove"
      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-error-500/10 hover:text-error-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 size={15} aria-hidden />
    </button>
  );

  const rateColumns: Column<ProjectRate>[] = [
    {
      key: "who",
      header: "Applies to",
      primary: true,
      sortable: true,
      value: whoOf,
      render: (row) => (
        <span className="flex min-w-0 items-center gap-3">
          <WhoTile row={row} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{whoOf(row)}</span>
            <span className="block truncate text-xs text-neutral-500">
              {sayJobTitle(row.sourceLabel)}
              {row.note !== null && row.note !== "" && ` · ${row.note}`}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      sortable: true,
      value: (row) => (row.userId !== null ? "Person" : row.disciplineId !== null ? "Job title" : "Fallback"),
      /* A person's own rate beats their job title's. */
      render: (row) => <KindChip row={row} />,
    },
    {
      key: "rate",
      header: "Per hour",
      sortable: true,
      align: "right",
      value: (row) => row.rateMinor,
      render: (row) => (
        <span className="text-[15px] font-bold tabular-nums text-neutral-900">{rateLabel(row.rateMinor, row.currency)}</span>
      ),
    },
    {
      key: "actions",
      header: "Remove",
      align: "right",
      tableOnly: true,
      render: removeButton,
    },
  ];

  const fxColumns: Column<ExchangeRateRow>[] = [
    {
      key: "pair",
      header: "Rate",
      primary: true,
      value: (row) => `${row.base}/${row.quote}`,
      render: (row) => (
        <span className="flex items-center gap-3">
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE.sky.soft)}>
            <ArrowLeftRight size={16} aria-hidden />
          </span>
          <span className="font-semibold text-neutral-900">
            1 {row.base} = {row.rate.toLocaleString("en-NG")} {row.quote}
          </span>
        </span>
      ),
    },
    {
      key: "asOf",
      header: "True on",
      sortable: true,
      value: (row) => row.asOf,
      render: (row) => <span className="text-neutral-700">as of {fmtDate(row.asOf)}</span>,
    },
    {
      key: "fresh",
      header: "Freshness",
      value: (row) => row.daysOld,
      render: (row) =>
        row.isStale ? (
          /* Flagged, never used to refuse a conversion. */
          <Chip hue="sun" icon={CalendarClock}>
            {row.daysOld} days old
          </Chip>
        ) : (
          <Chip hue="mint" dot>
            Current
          </Chip>
        ),
    },
    {
      key: "note",
      header: "Direction",
      hideOnMobile: true,
      value: () => "Converts both ways",
      render: () => <span className="text-xs text-neutral-500">Converts both ways</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      {error !== null && <Notice>{error}</Notice>}

      <StatGrid>
        <StatCard featured label="Rates on the card" value={card.length} icon={BadgeDollarSign} hint={`New rates start at ${rateLabel(defaults.minor, defaults.currency)}`} />
        <StatCard
          label="Job titles priced"
          value={disciplines.length - unpriced.length}
          unit={`of ${disciplines.length}`}
          icon={Layers}
          hue={unpriced.length > 0 ? "sun" : "mint"}
          hint={
            unpriced.length === 0
              ? "Every job title has a rate"
              : fallback !== null
                ? `${unpriced.length} on the fallback rate`
                : `${unpriced.length} cost nothing yet`
          }
        />
        <StatCard label="Personal rates" value={personal} icon={UserRound} hue="grape" hint="Beat their job title's rate" />
        <StatCard
          label="Exchange rates"
          value={fxRates.length}
          icon={Coins}
          hue="sky"
          hint={stale > 0 ? `${stale} stale — still used, and flagged` : fxRates.length === 0 ? "None set" : "All current"}
        />
      </StatGrid>

      {/* --------------------------- the card -------------------------- */}

      <section aria-labelledby="rate-card-heading">
        <SectionHeading
          title={<span id="rate-card-heading">Rate card</span>}
          hint="What an hour costs. A project can override any of these, and a person's own rate beats their job title's."
        />

        {unpriced.length > 0 &&
          (fallback !== null ? (
            <Notice tone="info" className="mb-4">
              No rate of {unpriced.length === 1 ? "its" : "their"} own for {unpriced.map((d) => d.label).join(", ")}.
              Hours logged against {unpriced.length === 1 ? "it" : "them"} are priced at the fallback rate (
              {rateLabel(fallback.rateMinor, fallback.currency)}) until there is one.
            </Notice>
          ) : (
            <Notice tone="warn" className="mb-4">
              {/*
                With no fallback row either, an hour against an unpriced job
                title costs nothing, and a cost report that quietly totals free
                hours is wrong by whatever they were worth.
              */}
              No rate for {unpriced.map((d) => d.label).join(", ")}. Hours logged
              against {unpriced.length === 1 ? "it" : "them"} cost nothing until
              there is one.
            </Notice>
          ))}

        {card.length === 0 ? (
          <Panel>
            <Empty
              icon={Info}
              title="No rates yet"
              hint={`Add one per job title. New rates start at ${rateLabel(defaults.minor, defaults.currency)} an hour, which is a starting point rather than an answer.`}
              action={
                <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                  Add a rate
                </Button>
              }
            />
          </Panel>
        ) : (
          <DataView
            rows={card}
            columns={rateColumns}
            rowKey={(row) => row.id}
            storageKey="projects.rates"
            searchPlaceholder="Search rates"
            caption="Rate card"
            gridCols={3}
            renderCard={(row) => (
              <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <WhoTile row={row} size={42} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold text-neutral-900">{whoOf(row)}</h3>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{sayJobTitle(row.sourceLabel)}</p>
                  </div>
                  {removeButton(row)}
                </div>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">
                    {rateLabel(row.rateMinor, row.currency)}
                  </span>
                  <span className="text-sm text-neutral-500">per hour</span>
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <KindChip row={row} />
                  {row.note !== null && row.note !== "" && (
                    <span className="truncate text-xs text-neutral-500">{row.note}</span>
                  )}
                </div>
              </div>
            )}
            renderListItem={(row) => (
              <div className="flex items-center gap-3 px-5 py-3">
                <WhoTile row={row} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{whoOf(row)}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {sayJobTitle(row.sourceLabel)}
                    {row.note !== null && row.note !== "" && ` · ${row.note}`}
                  </p>
                </div>
                <KindChip row={row} />
                <span className="text-sm font-bold tabular-nums text-neutral-900">
                  {rateLabel(row.rateMinor, row.currency)}
                </span>
                {removeButton(row)}
              </div>
            )}
          />
        )}
      </section>

      {/* ------------------------ exchange rates ----------------------- */}

      <section aria-labelledby="fx-heading">
        <SectionHeading
          title={<span id="fx-heading">Exchange rates</span>}
          hint="Typed in, never guessed and never fetched — the rate you invoice at is the one your bank gave you."
        />

        {fxRates.length === 0 ? (
          <Panel>
            <Empty
              icon={ArrowLeftRight}
              hue="sky"
              title="No exchange rate set"
              hint="Without one, a naira project's figures cannot be shown in dollars — and nothing here will guess a rate for you."
              action={
                <Button icon={ArrowLeftRight} onClick={() => setSettingFx(true)}>
                  Set an exchange rate
                </Button>
              }
            />
          </Panel>
        ) : (
          <DataView
            rows={fxRates}
            columns={fxColumns}
            rowKey={(row) => row.id}
            storageKey="projects.fx"
            searchable={false}
            caption="Exchange rates"
            gridCols={3}
            renderCard={(row) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700">
                    <span className={cx("flex h-9 w-9 items-center justify-center rounded-xl", HUE.sky.soft)}>
                      <ArrowLeftRight size={16} aria-hidden />
                    </span>
                    {row.base} to {row.quote}
                  </span>
                  {row.isStale ? (
                    <Chip hue="sun" icon={CalendarClock}>
                      {row.daysOld} days old
                    </Chip>
                  ) : (
                    <Chip hue="mint" dot>
                      Current
                    </Chip>
                  )}
                </div>
                <p className="text-[22px] font-bold tracking-tight tabular-nums text-neutral-900">
                  1 {row.base} = {row.rate.toLocaleString("en-NG")} {row.quote}
                </p>
                <p className="mt-auto text-xs text-neutral-500">
                  As of {fmtDate(row.asOf)} · converts both ways
                </p>
              </div>
            )}
          />
        )}
      </section>

      {adding && (
        <RateForm
          defaults={defaults}
          busy={busy === "add"}
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            await run("add", () => ratesApi.set(input));
            setAdding(false);
          }}
        />
      )}

      {settingFx && (
        <FxForm
          busy={busy === "fx"}
          onCancel={() => setSettingFx(false)}
          onSubmit={async (input) => {
            await run("fx", () => fxApi.set(input));
            setSettingFx(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function WhoTile({ row, size = 36 }: { row: ProjectRate; size?: number }) {
  const Icon = row.userId !== null ? UserRound : row.disciplineId !== null ? Layers : Users;
  const hue = row.userId !== null ? "grape" : row.disciplineId !== null ? hueFor(row.discipline ?? "") : "slate";
  return (
    <span
      aria-hidden
      className={cx("flex shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.46)} />
    </span>
  );
}

function KindChip({ row }: { row: ProjectRate }) {
  if (row.userId !== null) {
    return (
      <Chip hue="grape" icon={UserRound}>
        Their own rate
      </Chip>
    );
  }
  if (row.disciplineId !== null) {
    return <Chip hue="sky">Job title</Chip>;
  }
  return <Chip hue="slate">Fallback</Chip>;
}

function RateForm({
  defaults,
  busy,
  onCancel,
  onSubmit,
}: {
  defaults: { minor: number; currency: string };
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    rateMinor: number;
    currency: string;
    disciplineId?: string | null;
    note?: string;
  }) => Promise<void>;
}) {
  const [disciplineId, setDisciplineId] = useState("");
  const [amount, setAmount] = useState(toMajor(defaults.minor));
  const [currency, setCurrency] = useState(defaults.currency);
  const [note, setNote] = useState("");

  const minor = toMinor(amount);

  return (
    <Modal
      title="Add a rate"
      subtitle="Per job title, or the fallback for everybody else."
      icon={BadgeDollarSign}
      onClose={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || minor <= 0) return;
        void onSubmit({
          rateMinor: minor,
          currency,
          disciplineId: disciplineId === "" ? null : disciplineId,
          note: note.trim() === "" ? undefined : note.trim(),
        });
      }}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || minor <= 0}>
            {busy ? "Saving…" : "Save the rate"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="rc-discipline" className={labelCls}>
            Job title
          </label>
          {/*
            Empty is the fallback rule, offered explicitly. Somebody whose job
            title has no rate falls through to it, and without it their hours
            cost nothing.
          */}
          <JobTitlePicker
            id="rc-discipline"
            mode="id"
            value={disciplineId}
            onChange={(value) => setDisciplineId(value)}
            clearable
            placeholder="Everybody else"
            aria-describedby="rc-discipline-hint"
          />
          <p id="rc-discipline-hint" className={hintCls}>
            Leave it empty for the fallback rate, which covers everybody else.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rc-amount" className={labelCls}>
              Per hour
            </label>
            <input
              id="rc-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="rc-currency" className={labelCls}>
              Currency
            </label>
            <SearchableSelect
              id="rc-currency"
              value={currency}
              onChange={setCurrency}
              searchPlaceholder="Search currencies"
              options={[
                { value: "USD", label: "$ US dollar" },
                { value: "NGN", label: "₦ Naira" },
              ]}
            />
            {/*
              Stated, because it is the one surprise in the design: a card in one
              currency on a project in another is converted when the hour is
              logged, and refused there if no FX rate exists.
            */}
            <p className={hintCls}>Converted to a project&apos;s own currency when time is logged.</p>
          </div>
        </div>

        <div>
          <label htmlFor="rc-note" className={labelCls}>
            Note
          </label>
          <input
            id="rc-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Agreed with finance in October"
            className={inputCls}
          />
        </div>
      </div>
    </Modal>
  );
}

function FxForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    base: string;
    quote: string;
    rateBp: number;
    asOf?: string;
  }) => Promise<void>;
}) {
  const [base, setBase] = useState("USD");
  const [quote, setQuote] = useState("NGN");
  const [value, setValue] = useState("");
  const [asOf, setAsOf] = useState(() => today());

  const parsed = Number.parseFloat(value);
  const valid = Number.isFinite(parsed) && parsed > 0 && base !== quote;

  return (
    <Modal
      title="Set an exchange rate"
      subtitle="The rate your bank gave you, on the day it gave it."
      icon={ArrowLeftRight}
      hue="sky"
      onClose={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || !valid) return;
        void onSubmit({
          base,
          quote,
          /* Basis points, so nothing carries a float rate over the wire. */
          rateBp: Math.round(parsed * 10000),
          asOf,
        });
      }}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !valid}>
            {busy ? "Saving…" : "Save the rate"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_1.4fr_1fr] items-end gap-3">
          <div>
            <label htmlFor="fx-base" className={labelCls}>
              One unit of
            </label>
            <SearchableSelect
              id="fx-base"
              value={base}
              onChange={setBase}
              searchPlaceholder="Search currencies"
              options={[
                { value: "USD", label: "USD" },
                { value: "NGN", label: "NGN" },
              ]}
            />
          </div>

          <div>
            <label htmlFor="fx-value" className={labelCls}>
              Buys
            </label>
            <input
              id="fx-value"
              type="number"
              step="0.0001"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="1580.50"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="fx-quote" className={labelCls}>
              Of
            </label>
            <SearchableSelect
              id="fx-quote"
              value={quote}
              onChange={setQuote}
              searchPlaceholder="Search currencies"
              options={[
                { value: "NGN", label: "NGN" },
                { value: "USD", label: "USD" },
              ]}
            />
          </div>
        </div>

        {base === quote && (
          <Notice tone="warn">Pick two different currencies — a currency is always worth one of itself.</Notice>
        )}

        <div>
          <label htmlFor="fx-date" className={labelCls}>
            True on
          </label>
          <input
            id="fx-date"
            type="date"
            value={asOf}
            max={today()}
            onChange={(e) => setAsOf(e.target.value)}
            className={inputCls}
          />
          {/*
            Shown beside every figure this converts, so a month-old rate is
            visible rather than assumed current.
          */}
          <p className={hintCls}>Shown wherever this rate is used.</p>
        </div>
      </div>
    </Modal>
  );
}
