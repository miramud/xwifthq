/**
 * The heading block every public section opens with: an optional lilac pill
 * eyebrow, a bold tight title and a short muted intro, centred by default.
 */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "center",
  as: Tag = "h2",
  className = "",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: "center" | "left";
  as?: "h1" | "h2";
  className?: string;
}) {
  const centred = align === "center";

  return (
    <div className={`${centred ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} ${className}`}>
      {eyebrow && <p className="xw-eyebrow mb-5">{eyebrow}</p>}
      <Tag className={Tag === "h1" ? "xw-h1" : "xw-h2"}>{title}</Tag>
      {intro && (
        <p className={`mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg ${centred ? "mx-auto max-w-xl" : ""}`}>
          {intro}
        </p>
      )}
    </div>
  );
}
