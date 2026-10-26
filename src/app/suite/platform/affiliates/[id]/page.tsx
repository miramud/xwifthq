import AffiliateDetail from "@/suite/platform/components/affiliates/AffiliateDetail";

export default async function PlatformAffiliatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AffiliateDetail affiliateId={id} />;
}
