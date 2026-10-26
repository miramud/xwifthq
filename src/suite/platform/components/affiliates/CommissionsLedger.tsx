"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HandCoins, Inbox } from "lucide-react";
import { Card, Empty, PageHeader } from "@/components/workspace/kit";
import { useAuth } from "@/lib/auth-store";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { platformAffiliates, type CommissionStatus } from "@/lib/api/affiliate-client";
import { canPlatform, PERM } from "@/suite/platform/access";
import { LoadError, Notice, Pager, useLoad } from "../ui";
import { CommissionsTable, COMMISSION_STATUS, useCommissionActions } from "./shared";

type Tab = CommissionStatus | "all";

function isTab(v: string | null | undefined): v is Tab {
  return v === "pending" || v === "approved" || v === "paid" || v === "reversed" || v === "all";
}

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: COMMISSION_STATUS.pending.label },
  { key: "approved", label: COMMISSION_STATUS.approved.label },
  { key: "paid", label: COMMISSION_STATUS.paid.label },
  { key: "reversed", label: COMMISSION_STATUS.reversed.label },
];

/**
 * Every commission across every affiliate. A commission is earned on a
 * referred organisation's first payment and held for the programme's hold
 * days before it is ready to pay; the daily job moves it on, and the platform
 * can move one on early or reverse it with a reason.
 */
export default function CommissionsLedger() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { user } = useAuth();
  const allowed = canPlatform(user, PERM.affiliatesView);
  const canManage = canPlatform(user, PERM.affiliatesManage);
  const initial = search?.get("status");

  const [tab, setTab] = useState<Tab>(isTab(initial) ? initial : "all");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchList = useCallback(
    () => platformAffiliates.commissions({ status: tab === "all" ? undefined : tab, page }),
    [tab, page],
  );
  const { data, error, reload, setData } = useLoad(fetchList, "Commissions didn't load.");

  const actions = useCommissionActions({
    onChanged: (row, message) => {
      setActionError(null);
      // A row that has left this tab's status leaves this tab's list.
      setData((d) =>
        d
          ? { ...d, data: d.data.map((c) => (c.id === row.id ? row : c)).filter((c) => tab === "all" || c.status === tab) }
          : d,
      );
      setNotice(message);
    },
    onError: setActionError,
  });

  const changeTab = (key: string) => {
    if (!isTab(key)) return;
    setTab(key);
    setPage(1);
    router.replace(key === "all" ? (pathname ?? "/suite/platform/affiliates/commissions") : `${pathname}?status=${key}`);
  };

  const header = (
    <PageHeader
      eyebrow="Affiliates"
      title="Commissions"
      subtitle="What each affiliate earned on a referred organisation's first payment, worked out on the price before the discount."
      tabs={TABS}
      activeTab={tab}
      onTab={changeTab}
    />
  );

  if (user && !allowed) {
    return (
      <div>
        {header}
        <Card>
          <Empty icon={Inbox} title="You can't see the affiliate programme" hint="Ask a platform owner for access to affiliates." />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <CommissionsTable
            rows={data.data}
            showAffiliate
            canManage={canManage}
            busy={actions.busy}
            onApprove={(c) => void actions.approve(c)}
            onReverse={actions.reverse}
            storageKey="platform.affiliates.commissions"
            empty={
              <Card>
                <Empty
                  icon={HandCoins}
                  title={tab === "all" ? "No commissions yet" : `Nothing ${COMMISSION_STATUS[tab].label.toLowerCase()}`}
                  hint="A commission is earned when a referred organisation makes its first payment."
                />
              </Card>
            }
          />
          <Pager page={data.meta.currentPage} lastPage={data.meta.lastPage} total={data.meta.total} onPage={setPage} noun="commissions" />
        </>
      )}

      {actions.dialog}
    </div>
  );
}
