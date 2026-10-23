import { CtaPanel } from "@/components/site/CtaPanel";

/**
 * The closing call to action on module and platform pages: the same deep
 * purple panel every public page ends on, with page specific words.
 */
export function CtaBanner({
  title,
  intro,
  primary,
  secondary,
}: {
  title: string;
  intro?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <CtaPanel
      title={title}
      intro={intro}
      primary={primary}
      secondary={secondary ?? { label: "View pricing", href: "/pricing" }}
    />
  );
}
