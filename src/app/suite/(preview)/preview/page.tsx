import { redirect } from "next/navigation";

/** There is no index of previews; the suite home lists them. */
export default function PreviewIndex() {
  redirect("/suite");
}
