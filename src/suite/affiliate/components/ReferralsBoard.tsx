"use client";

import { useCallback, useState } from "react";
import { Building2, Link2 } from "lucide-react";
import { ButtonLink, Chip, Empty, PageHeader } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Pager, formatDate, useLoad } from "@/suite/platform/components/ui";
import { myAffiliate, type Page, type Referral } from "@/lib/api/affiliate-client";
import { explained } from "./ui";

const COLUMNS: Column<Referral>[] = [
  {
    key: "organisation",
    header: "Organisation",
    primary: true,
    value: (r) => r.organisation?.name ?? "Organisation no longer on XwiftHQ",
    render: (r) => <span className="font-medium text-neutral-900">{r.organisation?.name ?? "Organisation no longer on XwiftHQ"}</span>,
  },
  { key: "source", header: "How they came", value: (r) => r.sourceLabel, hideOnMobile: true },
  { key: "referredAt", header: "Referred on", value: (r) => r.referredAt ?? "", render: (r) => formatDate(r.referredAt) },
  { key: "firstPaidAt", header: "First paid on", value: (r) => r.firstPaidAt ?? "", render: (r) => formatDate(r.firstPaidAt), hideOnMobile: true },
  {
    key: "status",
    header: "Status",
    value: (r) => r.statusLabel,
    render: (r) => (
      <Chip hue={r.status === "paying" ? "mint" : "sky"} dot>
        {r.statusLabel}
      </Chip>
    ),
  },
];

/**
 * The organisations an affiliate's link brought in, newest first, and
 * whether each has made the first payment their commission comes from. The
 * API pages the list, so there is no search box: it could only search the
 * page on screen.
 */
export default function ReferralsBoard() {
  const [page, setPage] = useState(1);
  const fetcher = useCallback(() => explained(myAffiliate.referrals(page)), [page]);
  const { data, error, loading, reload } = useLoad<Page<Referral>>(fetcher, "Your referrals didn't load.");

  return (
    <>
      <PageHeader
        title="Referrals"
        subtitle="Organisations that signed up through your link, and whether they have paid."
      />

      {error && <LoadError message={error} onRetry={reload} />}

      {!data ? (
        !error && <Skeleton className="h-72" />
      ) : (
        <div aria-busy={loading} className={error ? "mt-4" : undefined}>
          <DataView
            rows={data.data}
            columns={COLUMNS}
            rowKey={(r) => r.id}
            storageKey="affiliate-referrals"
            views={["table", "list"]}
            searchable={false}
            caption="Organisations you referred"
            empty={
              <Empty
                icon={Building2}
                hue="mint"
                title="No organisations yet"
                hint="Share your link. Every organisation that signs up through it appears here."
                action={
                  <ButtonLink href="/suite/affiliate" icon={Link2} variant="primary">
                    Get your link
                  </ButtonLink>
                }
              />
            }
          />
          <Pager
            page={data.meta.currentPage}
            lastPage={data.meta.lastPage}
            total={data.meta.total}
            onPage={setPage}
            noun={data.meta.total === 1 ? "organisation" : "organisations"}
          />
        </div>
      )}
    </>
  );
}
