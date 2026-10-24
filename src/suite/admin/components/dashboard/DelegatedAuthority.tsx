import {
  DataTable,
  Pill,
  SectionCard,
  type DataTableColumn,
} from "@/components/suite/ui";
import {
  ADMIN_DATA,
  formatCompactNaira,
  naira,
  type ApprovalRow,
} from "@/lib/suite-data";

/**
 * The delegated authority matrix, and the requisitions currently inside it.
 *
 * The chart separates its two series by *fill pattern* as well as shade, so
 * colour is never the only signal: cleared value is solid purple, value still
 * in the matrix is hatched in a lighter purple. A reader who cannot tell two
 * shades apart can still tell solid from hatched, and the legend names both
 * in words.
 *
 * The bands, their thresholds and the per-band figures are all derived from
 * `ADMIN_DATA.approvals` below rather than shipped as a second fixture, so the
 * chart, the matrix table and the queue can never disagree with one another.
 */

/* ---------- the matrix ------------------------------------------- */

interface ValueBand {
  key: string;
  /** Short form, for the chart's x axis. */
  short: string;
  label: string;
  category: string;
  approver: string;
  /** Inclusive floor, exclusive ceiling. `Infinity` for the top band. */
  min: number;
  max: number;
}

const BANDS: readonly ValueBand[] = [
  {
    key: "band-1",
    short: "≤1M",
    label: "Up to ₦1M",
    category: "Consumables and routine spend",
    approver: "Department head",
    min: 0,
    max: 1_000_000,
  },
  {
    key: "band-2",
    short: "1 to 5M",
    label: "₦1M to ₦5M",
    category: "Equipment, services, short contracts",
    approver: "Department head, then Facilities",
    min: 1_000_000,
    max: 5_000_000,
  },
  {
    key: "band-3",
    short: "5 to 10M",
    label: "₦5M to ₦10M",
    category: "Capital items and annual contracts",
    approver: "Facilities, then Finance",
    min: 5_000_000,
    max: 10_000_000,
  },
  {
    key: "band-4",
    short: ">10M",
    label: "Above ₦10M",
    category: "Fit-outs, fleet and project spend",
    approver: "Finance, then the executive",
    min: 10_000_000,
    max: Number.POSITIVE_INFINITY,
  },
];

/** A requisition has cleared only when every stage in its band has signed. */
const isCleared = (row: ApprovalRow) => row.status === "Approved";

interface BandRollup extends ValueBand {
  cleared: number;
  /** Awaiting, in review or sent back: anything still inside the matrix. */
  open: number;
  pendingCount: number;
  clearedCount: number;
}

const ROLLUP: readonly BandRollup[] = BANDS.map((band) => {
  const rows = ADMIN_DATA.approvals.filter(
    (row) => row.amount >= band.min && row.amount < band.max,
  );
  const cleared = rows.filter(isCleared);
  const open = rows.filter((row) => !isCleared(row));

  return {
    ...band,
    cleared: cleared.reduce((sum, row) => sum + row.amount, 0),
    open: open.reduce((sum, row) => sum + row.amount, 0),
    clearedCount: cleared.length,
    pendingCount: open.length,
  };
});

/* ---------- the chart -------------------------------------------- */

/* Plot geometry. A wide viewBox keeps the 10px type legible once the SVG is
   scaled to the card's width; `meet` preserves the hatch angle, which
   `preserveAspectRatio="none"` would shear into something else. */
const PLOT = { left: 46, right: 396, top: 12, bottom: 148 };
const TICKS = [0, 5, 10, 15, 20];
const CEILING = 20_000_000;

function ApprovalLadder() {
  const span = PLOT.bottom - PLOT.top;
  const slot = (PLOT.right - PLOT.left) / ROLLUP.length;
  const barWidth = 44;
  const scale = (value: number) => (value / CEILING) * span;

  return (
    <figure className="m-0">
      <svg
        viewBox="0 0 400 172"
        className="h-44 w-full"
        role="img"
        aria-label={`Requisition value by authority band. Four bands rising from ${formatCompactNaira(
          ROLLUP[0].cleared + ROLLUP[0].open,
        )} up to ${formatCompactNaira(
          ROLLUP[ROLLUP.length - 1].cleared + ROLLUP[ROLLUP.length - 1].open,
        )}, each split into value already cleared and value still in the matrix.`}
      >
        <defs>
          {/* The second series. Pattern as well as shade: see the note above. */}
          <pattern
            id="admin-authority-hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" className="fill-primary-50" />
            <rect width="2.5" height="6" className="fill-primary-300" />
          </pattern>
        </defs>

        {TICKS.map((tick) => {
          const y = PLOT.bottom - scale(tick * 1_000_000);
          return (
            <g key={tick}>
              <line
                x1={PLOT.left}
                x2={PLOT.right}
                y1={y}
                y2={y}
                className={tick === 0 ? "stroke-neutral-300" : "stroke-neutral-100"}
                strokeWidth="1"
              />
              <text
                x={PLOT.left - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                className="fill-neutral-500"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {ROLLUP.map((band, index) => {
          const x = PLOT.left + index * slot + (slot - barWidth) / 2;
          const clearedHeight = scale(band.cleared);
          const openHeight = scale(band.open);
          const total = clearedHeight + openHeight;

          return (
            <g key={band.key} className="animate-grow-up" style={{ animationDelay: `${index * 70}ms` }}>
              {band.open > 0 && (
                <rect
                  x={x}
                  y={PLOT.bottom - total}
                  width={barWidth}
                  height={openHeight}
                  rx="4"
                  fill="url(#admin-authority-hatch)"
                  className="stroke-primary-400"
                  strokeWidth="1"
                />
              )}
              {band.cleared > 0 && (
                <rect
                  x={x}
                  y={PLOT.bottom - clearedHeight}
                  width={barWidth}
                  height={clearedHeight}
                  rx="4"
                  className="fill-primary-600"
                />
              )}
              <text
                x={x + barWidth / 2}
                y={PLOT.bottom + 15}
                textAnchor="middle"
                fontSize="9.5"
                className="fill-neutral-600"
              >
                {band.short}
              </text>
            </g>
          );
        })}

        <text x={PLOT.left - 8} y={PLOT.top - 2} textAnchor="end" fontSize="8.5" className="fill-neutral-500">
          ₦M
        </text>
      </svg>

      {/* A chart a screen reader cannot read is not made accessible by a label. */}
      <table className="sr-only">
        <caption>
          Requisition value by authority band, in Naira, split between cleared and
          still in the matrix.
        </caption>
        <thead>
          <tr>
            <th scope="col">Band</th>
            <th scope="col">Cleared</th>
            <th scope="col">Still in the matrix</th>
          </tr>
        </thead>
        <tbody>
          {ROLLUP.map((band) => (
            <tr key={band.key}>
              <th scope="row">{band.label}</th>
              <td>{naira(band.cleared)}</td>
              <td>{naira(band.open)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-[3px] bg-primary-600"
            aria-hidden="true"
          />
          Cleared
        </span>
        <span className="inline-flex items-center gap-2">
          {/* The same hatch the bars use, so the key matches the chart exactly. */}
          <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
            <rect
              x="0.5"
              y="0.5"
              width="11"
              height="11"
              rx="2.5"
              fill="url(#admin-authority-hatch)"
              className="stroke-primary-400"
            />
          </svg>
          Still in the matrix
        </span>
        <span className="text-neutral-500">Value in ₦ millions</span>
      </figcaption>
    </figure>
  );
}

/* ---------- the queue -------------------------------------------- */

const COLUMNS: readonly DataTableColumn<ApprovalRow>[] = [
  {
    key: "ref",
    header: "Ref",
    render: (row) => (
      <span className="font-mono text-xs font-medium text-neutral-900 tnum">
        {row.ref}
      </span>
    ),
  },
  {
    key: "title",
    header: "Requisition",
    render: (row) => (
      <span className="block min-w-[12rem]">
        <span className="block font-medium text-neutral-900">{row.title}</span>
        <span className="block text-xs text-neutral-500">
          Raised by {row.requester}
        </span>
      </span>
    ),
  },
  {
    key: "stage",
    header: "Stage",
    render: (row) => (
      <span className="whitespace-nowrap text-neutral-600 tnum">{row.stage}</span>
    ),
  },
  {
    key: "amount",
    header: "Value",
    align: "right",
    render: (row) => (
      <span className="whitespace-nowrap font-medium text-neutral-900">
        {naira(row.amount)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <Pill tone={row.tone}>{row.status}</Pill>,
  },
];

/* ---------- the card --------------------------------------------- */

export function DelegatedAuthority() {
  const pending = ROLLUP.reduce((sum, band) => sum + band.pendingCount, 0);

  return (
    <SectionCard
      title="Delegated authority"
      subtitle="One approval matrix, applied by every module"
      bodyClassName="divide-y divide-neutral-100"
    >
      <div className="px-5 pb-5">
        <ApprovalLadder />
      </div>

      <div className="px-5 py-5">
        <h4 className="text-sm font-semibold text-neutral-900">
          Approval bands
        </h4>
        <p className="mt-0.5 text-xs text-neutral-500">
          The value band decides the signatures, not the department. Admin holds
          the matrix; Finance, HRM, LMS and Projects all read it.
        </p>

        <div
          tabIndex={0}
          role="region"
          aria-label="Approval bands: value band, category, approvers and how many requisitions are waiting."
          className="mt-3 overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
        >
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">
              Approval bands: value band, category, approvers and how many
              requisitions are waiting in each band.
            </caption>
            <thead>
              <tr className="border-b border-neutral-200">
                <th
                  scope="col"
                  className="whitespace-nowrap py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Band
                </th>
                <th
                  scope="col"
                  className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Category
                </th>
                <th
                  scope="col"
                  className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Approver
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Waiting
                </th>
              </tr>
            </thead>
            <tbody>
              {ROLLUP.map((band) => (
                <tr key={band.key} className="border-b border-neutral-100 last:border-0">
                  <th
                    scope="row"
                    className="whitespace-nowrap py-3 pr-4 text-left font-medium text-neutral-900 tnum"
                  >
                    {band.label}
                  </th>
                  <td className="py-3 pr-4 text-neutral-600">{band.category}</td>
                  <td className="py-3 pr-4 text-neutral-600">{band.approver}</td>
                  <td className="py-3 text-right font-semibold text-neutral-900 tnum">
                    {band.pendingCount}
                    <span className="sr-only">
                      {band.pendingCount === 1 ? " requisition" : " requisitions"} waiting
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="py-1">
        <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4">
          <h4 className="text-sm font-semibold text-neutral-900">
            Requisitions in the matrix
          </h4>
          <p className="text-xs text-neutral-500 tnum">
            {pending} of {ADMIN_DATA.approvals.length} still open
          </p>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={ADMIN_DATA.approvals}
          caption="Requisitions in the approval matrix: reference, requisition, requester, stage, value and status."
        />
      </div>
    </SectionCard>
  );
}
