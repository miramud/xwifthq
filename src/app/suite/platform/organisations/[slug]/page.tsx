import { Suspense } from "react";
import OrganisationDetail from "@/suite/platform/components/organisations/OrganisationDetail";

export default function PlatformOrganisationPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense>
      <OrganisationDetail params={params} />
    </Suspense>
  );
}
