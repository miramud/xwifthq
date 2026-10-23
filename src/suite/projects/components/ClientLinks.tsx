"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Plus,
  Share2,
  ShieldOff,
  X,
} from "lucide-react";
import { Button, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import {
  ApiError,
  shares as sharesApi,
  type Project,
  type ProjectShare,
} from "@/lib/api/projects-client";
import { IconTile, MiniStat, Notice, Skeleton, hintCls, inputCls, labelCls } from "./ui/pkit";

/**
 * Links that let a client see this project without an account.
 *
 * **The link is shown once.** A secret a screen can re-display is a secret
 * sitting in a database in plain text, so the server keeps only a digest and
 * this screen has one chance to put the URL in front of somebody. That is
 * unusual enough to be worth saying loudly rather than discovering — the panel
 * stays open until it is dismissed, and says plainly that it will not come
 * back.
 *
 * **What the link carries is listed before one is made, not after.** Somebody
 * about to send a URL to a client should not have to open it themselves to
 * find out what is on it. Both lists come from the server, so the warning
 * cannot drift out of step with what the payload actually contains.
 *
 * **Revoked and expired are shown apart.** They have different remedies —
 * somebody deliberately stopped this one, versus it simply ran out — and a
 * single "inactive" badge would hide which happened.
 */
export default function ClientLinks({ project }: { project: Project }) {
  const [rows, setRows] = useState<ProjectShare[]>([]);
  const [meta, setMeta] = useState<{
    defaultDays: number;
    maxDays: number;
    shows: string[];
    hides: string[];
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);

  /** The one and only sight of a token. */
  const [minted, setMinted] = useState<{ url: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    sharesApi
      .forProject(project.slug)
      .then((response) => {
        if (!live) return;

        setRows(response.data);
        setMeta(response.meta);
        setError(null);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!live) return;

        setError(e instanceof ApiError ? e.message : "Could not load the links.");
        setLoaded(true);
      });

    return () => {
      live = false;
    };
  }, [project.slug, reloadKey]);

  async function create() {
    if (label.trim() === "" || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await sharesApi.create(project.slug, {
        label: label.trim(),
        days: days === "" ? undefined : Number.parseInt(days, 10),
      });

      setMinted({
        url: `${window.location.origin}/shared/${response.meta.token}`,
        label: response.data.label,
      });

      setLabel("");
      setDays("");
      setAdding(false);
      setCopied(false);
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setError(
        e instanceof ApiError
          ? (e.errors?.label?.[0] ?? e.errors?.days?.[0] ?? e.message)
          : "That link could not be made.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await sharesApi.revoke(project.slug, id);

      setRevoking(null);
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That link could not be revoked.");
    }
  }

  const liveCount = rows.filter((r) => r.isLive).length;
  const totalViews = rows.reduce((sum, r) => sum + r.viewCount, 0);

  const columns: Column<ProjectShare>[] = [
    {
      key: "label",
      header: "For",
      primary: true,
      value: (s) => s.label,
      sortable: true,
      render: (s) => (
        <span className="flex min-w-0 items-center gap-3">
          <IconTile icon={Link2} hue={s.isLive ? "mint" : "slate"} size={34} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-neutral-900">{s.label}</span>
            <span className="font-mono text-[11px] text-neutral-500">…{s.hint}</span>
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      value: (s) => (s.isLive ? s.daysLeft : -1),
      sortable: true,
      render: (s) => <ShareStatus share={s} />,
    },
    {
      key: "made",
      header: "Made",
      value: (s) => s.createdOn,
      sortable: true,
      hideOnMobile: true,
      render: (s) => (
        <span className="block text-xs text-neutral-600">
          {s.createdBy ?? "Somebody"} · {s.createdOn} · expires {s.expiresOn}
        </span>
      ),
    },
    {
      key: "views",
      header: "Views",
      value: (s) => s.viewCount,
      sortable: true,
      render: (s) => <Views share={s} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => revokeControl(s),
    },
  ];

  /* A plain function, so the confirm step is not remounted on every render. */
  function revokeControl(share: ProjectShare) {
    if (!share.isLive) return null;

    return revoking === share.id ? (
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        <Button size="sm" variant="danger" onClick={() => void revoke(share.id)}>
          Revoke it
        </Button>
        <Button size="sm" onClick={() => setRevoking(null)}>
          Keep
        </Button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setRevoking(share.id)}
        aria-label={`Revoke the link for ${share.label}`}
        title="Stop this link working"
        className="ml-auto flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-error-50 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        <ShieldOff size={16} aria-hidden />
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={Share2} hue="sky" size={40} />
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold tracking-tight text-neutral-900">Client links</h2>
            <p className="text-sm text-neutral-500">
              {liveCount === 0
                ? "No live links — nobody outside can see this project"
                : `${liveCount} live ${liveCount === 1 ? "link" : "links"}`}
            </p>
          </div>
        </div>
        {!adding && (
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            New link
          </Button>
        )}
      </div>

      {error !== null && <Notice tone="error">{error}</Notice>}

      {/* ---------------- the one sight of the token ---------------- */}
      {minted !== null && (
        <div className="ws-card border-mint-100 bg-mint-50/60 p-5">
          <div className="flex items-start gap-3">
            <IconTile icon={KeyRound} hue="mint" size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-mint-700">
                Here is the link for {minted.label}
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                <strong className="font-semibold text-neutral-800">Copy it now.</strong> It is not stored anywhere we can read,
                so this is the only time it can be shown. If you lose it, revoke
                this one and make another.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={minted.url}
              aria-label="The client link"
              onFocus={(e) => e.currentTarget.select()}
              className={cx(inputCls, "min-w-0 flex-1 font-mono text-xs")}
            />
            <Button
              variant="primary"
              icon={copied ? Check : Copy}
              onClick={() => {
                void navigator.clipboard?.writeText(minted.url);
                setCopied(true);
              }}
              className="shrink-0"
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setMinted(null)}>
            I have copied it — hide this
          </Button>
        </div>
      )}

      {/* ---------------- making one ---------------- */}
      {adding && meta !== null && (
        <Panel title="A new client link" icon={Link2} hue="sky">
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <div>
              <label htmlFor="share-label" className={labelCls}>
                Who is it for?
              </label>
              <input
                id="share-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Acme, Tolu"
                aria-describedby="share-label-hint"
                className={inputCls}
              />
              <p id="share-label-hint" className={hintCls}>
                So you can revoke the right one later.
              </p>
            </div>

            <div>
              <label htmlFor="share-days" className={labelCls}>
                Lasts for
              </label>
              <input
                id="share-days"
                type="number"
                min={1}
                max={meta.maxDays}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder={String(meta.defaultDays)}
                className={inputCls}
              />
              <p className={hintCls}>days, up to {meta.maxDays}</p>
            </div>
          </div>

          {/*
            Before, not after. Somebody about to send a URL to a client should
            not have to open it themselves to find out what is on it.
          */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-mint-50/70 p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-mint-700">
                <Eye size={15} aria-hidden />
                They will see
              </p>
              <ul className="mt-2 space-y-1.5">
                {meta.shows.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-xs text-neutral-700">
                    <Check size={13} className="mt-px shrink-0 text-mint-600" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-coral-50/70 p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-coral-700">
                <EyeOff size={15} aria-hidden />
                They will not see
              </p>
              <ul className="mt-2 space-y-1.5">
                {meta.hides.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-xs text-neutral-700">
                    <X size={13} className="mt-px shrink-0 text-coral-600" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button
              variant="primary"
              disabled={busy || label.trim() === ""}
              onClick={() => void create()}
            >
              {busy ? "Making…" : "Make the link"}
            </Button>
            <Button
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {/* ---------------- what exists ---------------- */}
      {!loaded ? (
        <Skeleton className="h-56" />
      ) : (
        <>
          {rows.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Live now" value={liveCount} hue="mint" />
              <MiniStat label="Views in total" value={totalViews} hue="sky" />
              <MiniStat label="Stopped or run out" value={rows.length - liveCount} />
            </div>
          )}

          <DataView
            rows={rows}
            columns={columns}
            rowKey={(s) => s.id}
            storageKey="projects.client-links"
            caption="Client links for this project"
            searchPlaceholder="Search links"
            empty={
              <Empty
                icon={Link2}
                hue="sky"
                title="No client links"
                hint="A link lets somebody outside see status, milestones and dates — and nothing else."
              />
            }
            renderCard={(s) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  {columns[0].render?.(s)}
                  {revokeControl(s)}
                </div>
                <ShareStatus share={s} />
                <p className="text-xs text-neutral-600">
                  {s.createdBy ?? "Somebody"} · {s.createdOn} · expires {s.expiresOn}
                </p>
                <div className="mt-auto border-t border-neutral-100 pt-3">
                  <Views share={s} />
                </div>
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}

function ShareStatus({ share }: { share: ProjectShare }) {
  return share.isLive ? (
    <Chip hue="mint" dot>
      Live · {share.daysLeft} {share.daysLeft === 1 ? "day" : "days"} left
    </Chip>
  ) : (
    /* Named apart: different causes, different remedies. */
    <Chip hue={share.deadReason === "revoked" ? "coral" : "slate"}>
      {share.deadReason === "revoked" ? "Revoked" : "Expired"}
    </Chip>
  );
}

/*
  A link made three weeks ago and never opened is either the wrong address or
  a client nobody told.
*/
function Views({ share }: { share: ProjectShare }) {
  return (
    <span
      className={cx(
        "flex items-center gap-1.5 text-xs",
        share.viewCount === 0 ? "text-sun-700" : "text-neutral-600",
      )}
    >
      <Eye size={13} className="shrink-0" aria-hidden />
      {share.viewCount === 0
        ? "Never opened"
        : `Opened ${share.viewCount} ${share.viewCount === 1 ? "time" : "times"}, last on ${share.lastViewedAt}`}
    </span>
  );
}
