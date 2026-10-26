import { Suspense } from "react";
import CommissionsLedger from "@/suite/platform/components/affiliates/CommissionsLedger";

export default function PlatformAffiliateCommissionsPage() {
  // Reads `?status=`, so it needs a Suspense boundary to render statically.
  return (
    <Suspense>
      <CommissionsLedger />
    </Suspense>
  );
}
