"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Banknote, Clock4, Download, FileWarning, Hourglass, HandCoins, Receipt, ShieldAlert, Stamp, TriangleAlert } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import type { Hue } from "@/components/workspace/modules";
import { BackLink, ListRow, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { spend, spendError, type AgeingCommitment, type FcuExceptions, type UnauthorisedPayment } from "@/lib/api/finance-spend-client";
import { mayDo, mayUseFinance } from "@/suite/finance/lib/finance-access";
import { amount, day } from "@/suite/finance/lib/format";
import { Money } from "@/suite/finance/components/banking/ui";
import { memoStatus, voucherStatus } from "@/suite/finance/components/requests/labels";
import ReasonDialog from "@/suite/finance/components/vouchers/ReasonDialog";
import RegulariseDialog, { type RegulariseResult } from "./RegulariseDialog";

/**
 * The FCU's exceptions board: what slipped past the controls or is taking
 * too long - money that left a bank account with no voucher behind it (and
 * its regularisation), payments confirmed on a receipt that never met their
 * statement line, memos not cleared in time, advances not retired, memos
 * raised after the money was spent, and approved memos nobody pays.
 */

type Key = keyof FcuExceptions;

interface Group {
  key: Key;
  title: string;
  hint: string;
  icon: typeof TriangleAlert;
  hue: Hue;
}

const GROUPS: Group[] = [
  { key: "unauthorisedPayments", title: "Payments with no voucher", hint: "Debits on a bank statement that no voucher authorised. Regularise each with a post-facto memo.", icon: ShieldAlert, hue: "rose" },
  { key: "postFacto", title: "Raised after the spend", hint: "Post-facto memos regularising money already paid; their vouchers match the original debit", icon: FileWarning, hue: "sky" },
  { key: "ageingCommitments", title: "Ageing commitments", hint: "Approved, nothing paid, still holding project funds", icon: Hourglass, hue: "sun" },
  { key: "unmatchedProvisional", title: "Provisional, still unmatched", hint: "Confirmed on the bank's receipt; the statement line hasn't been matched", icon: Receipt, hue: "sun" },
  { key: "memosNotCleared", title: "Memos not cleared in time", hint: "Waiting for the FCU longer than allowed", icon: Clock4, hue: "coral" },
  { key: "unretiredAdvances", title: "Advances not retired", hint: "Paid, and not accounted for in time", icon: HandCoins, hue: "grape" },
];

const rowsOf = (data: FcuExceptions, key: Key): unknown[] => data[key] ?? [];

export default function ExceptionsBoard() {
  const { user } = useAuth();
  const allowed = mayUseFinance(user, "fcu");
  const mayRegularise = mayDo(user, "fcu", "regularise");
  const mayExpire = mayDo(user, "memos", "expire");
  // Whoever may change the spend settings may expire before the date, by overriding.
  const mayExpireEarly = mayExpire && mayDo(user, "spend_settings", "update_settings");

  const [data, setData] = useState<FcuExceptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [regularising, setRegularising] = useState<UnauthorisedPayment | null>(null);
  const [expiring, setExpiring] = useState<AgeingCommitment | null>(null);
  const [notice, setNotice] = useState<{ text: string; href?: string; tone: "ok" | "warn" } | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    spend.fcu.exceptions().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`The exceptions didn't load. ${spendError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [allowed, reload]);

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Exceptions" />
        <Card>
          <Empty icon={ShieldAlert} title="The exceptions board is the FCU's" hint="Ask an administrator for the FCU officer role if you need it." />
        </Card>
      </div>
    );
  }

  const ageing = data?.ageingCommitments ?? [];
  const total = data ? GROUPS.reduce((s, g) => s + rowsOf(data, g.key).length, 0) : 0;
  const unauthorisedValue = data ? data.unauthorisedPayments.reduce((s, l) => s + l.amount, 0) : 0;
  const unregularised = data ? data.unauthorisedPayments.filter((l) => !l.regularising).length : 0;

  const regularised = (r: RegulariseResult) => {
    setRegularising(null);
    const ref = r.memo.reference ?? "The post-facto memo";
    setNotice(
      r.submitError
        ? { tone: "warn", text: `${ref} is raised as a draft: ${r.submitError} Open it to finish and send it.`, href: `/suite/finance/requests/${r.memo.id}` }
        : { tone: "ok", text: `${ref} is raised and sent for approval. Its voucher will be matched to this debit.`, href: `/suite/finance/requests/${r.memo.id}` },
    );
    setReload((k) => k + 1);
  };

  /* Every exception on the board, one row each, the group named in the first column. */
  const exportCsv = () => {
    if (!data) return;
    const title = (k: Key) => GROUPS.find((g) => g.key === k)?.title ?? k;
    downloadCsv("fcu-exceptions.csv", [
      ["Exception", "Reference", "Description", "Date", "Currency", "Amount", "Note"],
      ...data.unauthorisedPayments.map((l) => [
        title("unauthorisedPayments"),
        l.regularising?.reference ?? "",
        l.narration ?? "",
        csvDate(l.date),
        "NGN",
        csvAmount(l.amount),
        l.regularising ? "Being regularised" : l.posted ? "Posted to the books" : "Not posted yet",
      ]),
      ...data.postFacto.map((m) => [title("postFacto"), m.reference ?? "", m.title ?? "", csvDate(m.paidOn ?? null), "NGN", csvAmount(m.amount), m.status ? memoStatus(m.status).label : ""]),
      ...ageing.map((a) => [title("ageingCommitments"), a.reference ?? "", a.title ?? "", csvDate(a.approvedAt), "NGN", csvAmount(a.amount), `${a.ageDays} days; ${a.expirable ? "may be expired" : `expires ${a.expiresOn ?? ""}`}`]),
      ...data.unmatchedProvisional.map((p) => [title("unmatchedProvisional"), p.pvNo ?? "", p.payee, csvDate(p.confirmedAt), "NGN", csvAmount(p.amount), "Confirmed on the receipt"]),
      ...data.memosNotCleared.map((m) => [title("memosNotCleared"), m.reference ?? "", m.title ?? "", "", "NGN", csvAmount(m.amount), ""]),
      ...data.unretiredAdvances.map((a) => [title("unretiredAdvances"), a.reference ?? "", a.person ?? "", csvDate(a.since), "NGN", csvAmount(a.amount), "Paid, not retired"]),
    ]);
  };

  return (
    <div>
      <BackLink href="/suite/finance/fcu" label="FCU queues" />
      <PageHeader
        eyebrow="Finance Control Unit"
        title="Exceptions"
        subtitle="What slipped past the controls, or is taking too long. Each one links to where it is put right."
        actions={
          data && (
            <Button icon={Download} onClick={exportCsv} disabled={total === 0}>
              Download CSV
            </Button>
          )
        }
      />

      {notice && (
        <p
          role="status"
          className={cx(
            "mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-sm",
            notice.tone === "ok" ? "bg-mint-50 text-mint-700" : "bg-sun-50 text-sun-700",
          )}
        >
          <span>{notice.text}</span>
          {notice.href && (
            <Link href={notice.href} className="font-semibold underline underline-offset-2">
              Open the memo
            </Link>
          )}
        </p>
      )}

      {error && !data && <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />}
      {!data && !error && (
        <div aria-busy="true" className="space-y-5">
          <p className="sr-only">Loading the exceptions…</p>
          <Skeleton className="h-[132px]" />
          <Skeleton className="h-[360px]" />
        </div>
      )}

      {data && (
        <div className="space-y-5">
          <StatGrid cols={5}>
            <StatCard
              featured
              featuredHue={data.unauthorisedPayments.length ? "rose" : "mint"}
              label="Payments with no voucher"
              value={data.unauthorisedPayments.length}
              icon={ShieldAlert}
              hint={data.unauthorisedPayments.length ? `${amount(unauthorisedValue)} out of the bank${unregularised < data.unauthorisedPayments.length ? `; ${unregularised} not yet regularised` : ""}` : "None found"}
            />
            <StatCard label="Ageing commitments" value={ageing.length} icon={Hourglass} hue="sun" hint={ageing.some((a) => a.expirable) ? `${ageing.filter((a) => a.expirable).length} may be expired` : undefined} />
            <StatCard label="Provisional, unmatched" value={data.unmatchedProvisional.length} icon={Receipt} hue="sun" />
            <StatCard label="Memos not cleared in time" value={data.memosNotCleared.length} icon={Clock4} hue="coral" />
            <StatCard label="Advances not retired" value={data.unretiredAdvances.length} icon={HandCoins} hue="grape" hint={data.postFacto.length ? `${data.postFacto.length} raised after the spend` : undefined} />
          </StatGrid>

          {total === 0 ? (
            <Card>
              <Empty icon={BadgeCheck} hue="mint" title="No exceptions" hint="Every payment has its voucher, every confirmation its statement line, and nothing is overdue." />
            </Card>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {GROUPS.map((g) => {
                const rows = rowsOf(data, g.key);
                return (
                  <Panel
                    key={g.key}
                    title={g.title}
                    subtitle={g.hint}
                    icon={g.icon}
                    hue={rows.length ? g.hue : "slate"}
                    actions={
                      <Chip hue={rows.length ? g.hue : "slate"}>
                        {rows.length} {rows.length === 1 ? "item" : "items"}
                      </Chip>
                    }
                  >
                    {rows.length === 0 ? (
                      <p className="text-sm text-neutral-500">None.</p>
                    ) : (
                      <ul className="-mx-2">
                        {g.key === "unauthorisedPayments" &&
                          data.unauthorisedPayments.map((l) => (
                            <UnauthorisedRow key={l.lineId} line={l} mayRegularise={mayRegularise} onRegularise={() => setRegularising(l)} />
                          ))}
                        {g.key === "postFacto" &&
                          data.postFacto.map((m) => {
                            const st = m.status ? memoStatus(m.status) : null;
                            const pv = m.vouchers?.[0];
                            return (
                              <ListRow
                                key={m.memoId}
                                href={`/suite/finance/memos/${m.memoId}`}
                                title={m.title ?? "Memo"}
                                meta={[m.reference, m.paidOn ? `paid ${day(m.paidOn)}` : null, pv ? `${pv.pvNo ?? "Voucher"} ${voucherStatus(pv.status).label.toLowerCase()}` : null, st?.label].filter(Boolean).join(" · ")}
                                trailing={<Money value={m.amount} className="font-semibold" />}
                              />
                            );
                          })}
                        {g.key === "ageingCommitments" &&
                          ageing.map((a) => (
                            <AgeingRow
                              key={a.memoId}
                              row={a}
                              canExpire={mayExpire && (a.expirable || mayExpireEarly)}
                              onExpire={() => setExpiring(a)}
                            />
                          ))}
                        {g.key === "unmatchedProvisional" &&
                          data.unmatchedProvisional.map((p) => (
                            <ListRow
                              key={p.pvId}
                              href={`/suite/finance/fcu/payments/${p.pvId}`}
                              title={`${p.pvNo ?? "Voucher"} · ${p.payee}`}
                              meta={p.confirmedAt ? `Confirmed on the receipt ${day(p.confirmedAt)}` : "Confirmed on the receipt"}
                              trailing={<Money value={p.amount} className="font-semibold" />}
                            />
                          ))}
                        {g.key === "memosNotCleared" &&
                          data.memosNotCleared.map((m) => (
                            <ListRow key={m.memoId} href={`/suite/finance/fcu/memos/${m.memoId}`} title={m.title ?? "Memo"} meta={m.reference ?? undefined} trailing={<Money value={m.amount} className="font-semibold" />} />
                          ))}
                        {g.key === "unretiredAdvances" &&
                          data.unretiredAdvances.map((a) => (
                            <ListRow
                              key={a.memoId}
                              href={`/suite/finance/memos/${a.memoId}`}
                              title={a.person ?? "Advance"}
                              meta={`${a.reference ?? ""}${a.since ? ` · paid ${day(a.since)}` : ""}`}
                              trailing={<Money value={a.amount} className="font-semibold" />}
                            />
                          ))}
                      </ul>
                    )}
                  </Panel>
                );
              })}
            </div>
          )}
          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Banknote size={13} aria-hidden /> How long counts as late, and when an unpaid memo may be expired, is set in Spend settings.
          </p>
        </div>
      )}

      {regularising && <RegulariseDialog line={regularising} onClose={() => setRegularising(null)} onDone={regularised} />}

      {expiring && (
        <ReasonDialog
          title={`Expire ${expiring.reference ?? "this memo"}?`}
          subtitle={
            expiring.expirable
              ? `Approved ${expiring.ageDays} days ago and nothing paid. Its ${amount(expiring.amount)} goes back to the project's available funds, and ${expiring.requester ?? "the requester"} is told. This can't be undone.`
              : `It may be expired from ${expiring.expiresOn ? day(expiring.expiresOn) : "its expiry date"}. You are expiring it early, as a finance manager; that is logged. Its ${amount(expiring.amount)} goes back to the project's available funds.`
          }
          label="Why it is expired"
          placeholder="e.g. The vendor never delivered; the requester confirmed it is no longer needed"
          tone="danger"
          maxLength={2000}
          confirmLabel={expiring.expirable ? "Expire memo" : "Expire early"}
          busyLabel="Expiring…"
          onClose={() => setExpiring(null)}
          onConfirm={async (reason) => {
            await spend.memos.expire(expiring.memoId, reason, !expiring.expirable);
            setNotice({ tone: "ok", text: `${expiring.reference ?? "The memo"} has expired and its funds are released.` });
            setExpiring(null);
            setReload((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

/** A debit with no voucher: open its statement, and regularise it (or see who is). */
function UnauthorisedRow({ line: l, mayRegularise, onRegularise }: { line: UnauthorisedPayment; mayRegularise: boolean; onRegularise: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-2.5 sm:flex-nowrap">
      <Link
        href={`/suite/finance/banking/imports/${l.importId}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-900">{l.narration ?? "No narration"}</span>
          <span className="mt-0.5 block truncate text-xs text-neutral-500">
            {day(l.date)}
            {l.posted ? " · posted to the books" : " · not posted yet"}
          </span>
        </span>
        <Money value={l.amount} className="shrink-0 font-semibold" />
      </Link>
      {l.regularising ? (
        <Link
          href={`/suite/finance/memos/${l.regularising.memoId}`}
          className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <Chip hue="sky" icon={Stamp}>
            Regularising · {l.regularising.reference ?? "draft memo"}
          </Chip>
        </Link>
      ) : (
        mayRegularise && (
          <Button size="sm" icon={Stamp} onClick={onRegularise} aria-label={`Regularise ${l.narration ?? "this debit"}`}>
            Regularise
          </Button>
        )
      )}
    </li>
  );
}

/** An approved memo nobody pays: how old, when it may expire, and Expire. */
function AgeingRow({ row: a, canExpire, onExpire }: { row: AgeingCommitment; canExpire: boolean; onExpire: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-2.5 sm:flex-nowrap">
      <Link
        href={`/suite/finance/memos/${a.memoId}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-900">{a.title ?? "Memo"}</span>
          <span className="mt-0.5 block truncate text-xs text-neutral-500">
            {[a.reference, a.project, `${a.ageDays} days since approval`].filter(Boolean).join(" · ")}
          </span>
        </span>
        <Money value={a.amount} className="shrink-0 font-semibold" />
      </Link>
      <Chip hue={a.expirable ? "rose" : "sun"}>{a.expirable ? "Past expiry" : `Expires ${a.expiresOn ? day(a.expiresOn) : "later"}`}</Chip>
      {canExpire && (
        <Button size="sm" variant={a.expirable ? "danger" : "ghost"} onClick={onExpire} aria-label={`Expire ${a.reference ?? a.title ?? "memo"}`}>
          {a.expirable ? "Expire" : "Expire early"}
        </Button>
      )}
    </li>
  );
}
