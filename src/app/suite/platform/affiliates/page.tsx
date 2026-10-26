import { Suspense } from "react";
import AffiliatesBoard from "@/suite/platform/components/affiliates/AffiliatesBoard";

export default function PlatformAffiliatesPage() {
  // Reads `?status=`, so it needs a Suspense boundary to render statically.
  return (
    <Suspense>
      <AffiliatesBoard />
    </Suspense>
  );
}
