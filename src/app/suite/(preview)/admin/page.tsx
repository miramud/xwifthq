import { permanentRedirect } from "next/navigation";

/** Every module's preview now lives under /suite/preview. */
export default function LegacyAdminPreviewRedirect() {
  permanentRedirect("/suite/preview/admin");
}
