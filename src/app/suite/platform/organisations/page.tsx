import { Suspense } from "react";
import OrganisationsList from "@/suite/platform/components/organisations/OrganisationsList";

export default function PlatformOrganisationsPage() {
  // Reads `?new=1`, so it needs a Suspense boundary to render statically.
  return (
    <Suspense>
      <OrganisationsList />
    </Suspense>
  );
}
