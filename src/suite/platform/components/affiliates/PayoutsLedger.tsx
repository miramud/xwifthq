"use client";

import { useCallback, useState } from "react";
import { Inbox } from "lucide-react";
import { Card, Empty, PageHeader } from "@/components/workspace/kit";
import { useAuth } from "@/lib/auth-store";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { platformAffiliates } from "@/lib/api/affiliate-client";
import { canPlatform, PERM } from "@/suite/platform/access";
import { LoadError, Pager, useLoad } from "../ui";
import { PayoutsTable } from "./shared";

/**
 * Every payout recorded to an affiliate. Payouts are made outside XwiftHQ
 * (a bank transfer, a cheque) and recorded from the affiliate's page, where
 * the amount is the sum of the commissions it settles.
 */
export default function PayoutsLedger() {
  const { user } = useAuth();
  const allowed = canPlatform(user, PERM.affiliatesView);
  const [page, setPage] = useState(1);

  const fetchList = useCallback(() => platformAffiliates.payouts({ page }), [page]);
  const { data, error, reload } = useLoad(fetchList, "Payouts didn't load.");

  const header = (
    <PageHeader
      eyebrow="Affiliates"
      title="Payouts"
      subtitle="Money paid to affiliates. Record a payout from the affiliate's page."
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
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <PayoutsTable rows={data.data} showAffiliate storageKey="platform.affiliates.payouts" />
          <Pager page={data.meta.currentPage} lastPage={data.meta.lastPage} total={data.meta.total} onPage={setPage} noun="payouts" />
        </>
      )}
    </div>
  );
}
