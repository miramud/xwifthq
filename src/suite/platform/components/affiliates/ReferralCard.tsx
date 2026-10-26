"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { Plus, Tag, Trash2 } from "lucide-react";
import { Button, Chip, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { HUE } from "@/components/workspace/modules";
import { useAuth } from "@/lib/auth-store";
import { ErrorNote, inputClass, labelClass, Skeleton } from "@/suite/lms/components/ui/ws";
import { ApiError, percentText, platformAffiliates } from "@/lib/api/affiliate-client";
import { canPlatform, PERM } from "@/suite/platform/access";
import { formatDate, LoadError, useLoad } from "../ui";
import { affiliateHref, fieldErrors } from "./shared";

/**
 * Which affiliate, if any, brought this organisation in. A referral can be
 * recorded by hand (by the affiliate's code) until the organisation has paid,
 * and removed before then; once it has paid, the commission rests on it.
 */
export default function ReferralCard({ slug }: { slug: string }) {
  const { user } = useAuth();
  // Staff without the affiliate permission would only be refused by the API.
  if (!canPlatform(user, PERM.affiliatesView)) return null;
  return <ReferralPanel slug={slug} canManage={canPlatform(user, PERM.affiliatesManage)} />;
}

function ReferralPanel({ slug, canManage }: { slug: string; canManage: boolean }) {
  const id = useId();
  const confirm = useConfirm();

  const fetchReferral = useCallback(() => platformAffiliates.organisationReferral(slug), [slug]);
  const { data, error, reload, setData } = useLoad(fetchReferral, "The referral didn't load.");

  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const referral = data?.referral ?? null;
  const paid = Boolean(referral?.firstPaidAt);

  async function record(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await platformAffiliates.attachReferral(slug, value);
      setData(() => next);
      setCode("");
    } catch (err) {
      setSaveError(fieldErrors(err).code ?? (err instanceof ApiError ? err.message : "The referral wasn't recorded."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!referral) return;
    const ok = await confirm({
      title: "Remove this referral?",
      body: `${referral.affiliate?.name ?? "The affiliate"} won't earn on this organisation's first payment, and that payment no longer gets the referral discount.`,
      confirmLabel: "Remove referral",
    });
    if (!ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await platformAffiliates.detachReferral(slug);
      setData(() => next);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "The referral wasn't removed.");
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Referral" subtitle="The affiliate who brought them in" icon={Tag} hue="grape">
      {error && !data ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-16" />
      ) : referral ? (
        <div className="space-y-3">
          <p className="text-sm text-neutral-800">
            Referred by{" "}
            {referral.affiliate ? (
              <Link href={affiliateHref(referral.affiliate.id)} className="font-semibold text-primary-700 hover:underline">
                {referral.affiliate.name}
                {referral.affiliate.code && <span className="font-mono"> ({referral.affiliate.code})</span>}
              </Link>
            ) : (
              <span className="font-semibold">an affiliate</span>
            )}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>
              {referral.sourceLabel}
              {referral.referredAt ? `, ${formatDate(referral.referredAt)}` : ""}
            </span>
            <Chip hue={paid ? "mint" : "sky"} dot>
              {paid ? `Paid ${formatDate(referral.firstPaidAt)}` : "Not paid yet"}
            </Chip>
          </p>
          {canManage && !paid && (
            <Button variant="ghost" icon={Trash2} disabled={saving} onClick={() => void remove()} className="text-error-700 hover:bg-error-50">
              Remove
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">No affiliate.</p>
          {canManage && (
            <form onSubmit={record} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor={`${id}-code`} className={labelClass}>
                  Affiliate code
                </label>
                <input
                  id={`${id}-code`}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setSaveError(null);
                  }}
                  autoComplete="off"
                  aria-invalid={Boolean(saveError)}
                  className={cx(inputClass, "font-mono")}
                />
              </div>
              <Button type="submit" icon={Plus} disabled={saving || !code.trim()}>
                Record referral
              </Button>
            </form>
          )}
        </div>
      )}

      {saveError && <ErrorNote className="mt-3">{saveError}</ErrorNote>}

      {data && data.discountPercent > 0 && (
        <p className={cx("mt-3 rounded-2xl px-4 py-3 text-xs", HUE.grape.soft)}>
          Their next payment gets the {percentText(data.discountPercent)} referral discount. The offline payment forms on
          this page already default to the discounted amount.
        </p>
      )}
    </Panel>
  );
}
