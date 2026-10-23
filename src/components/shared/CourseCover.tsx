/* ------------------------------------------------------------------ */
/*  Course cover art.                                                  */
/*                                                                      */
/*  Renders the uploaded thumbnail when the author set one, and falls   */
/*  back to the course's gradient + initials otherwise. Every course     */
/*  tile in the app goes through here so the two never diverge.         */
/* ------------------------------------------------------------------ */

const DEFAULT_GRADIENT = "from-primary-600 to-primary-800";

export function courseInitials(title: string): string {
  return (
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * A fixed-size square/rounded tile — used in tables, lists and sidebars.
 * `size` is in pixels.
 */
export function CourseThumb({
  title,
  gradient,
  thumbnailUrl,
  size = 40,
  rounded = "rounded-lg",
}: {
  title: string;
  gradient?: string | null;
  thumbnailUrl?: string | null;
  size?: number;
  rounded?: string;
}) {
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary host, no loader configured
      <img
        src={thumbnailUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={`shrink-0 object-cover ${rounded}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${gradient || DEFAULT_GRADIENT} font-bold text-white ${rounded}`}
      style={{ width: size, height: size, fontSize: size * 0.3 }}
      aria-hidden
    >
      {courseInitials(title)}
    </span>
  );
}

/**
 * Drop into any existing gradient tile to overlay the real cover image.
 * The parent must be `relative overflow-hidden`; the gradient stays behind as
 * the placeholder while the image loads, and as the fallback if it never does.
 */
export function CoverImage({
  src,
  alt,
  className = "",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary host, no loader configured
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}

/**
 * A responsive banner that fills its parent — used on cards and hero areas.
 * Children (badges, play buttons) render on top of the image or gradient.
 */
export function CourseCover({
  title,
  gradient,
  thumbnailUrl,
  className = "",
  children,
}: {
  title: string;
  gradient?: string | null;
  thumbnailUrl?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradient || DEFAULT_GRADIENT} ${className}`}>
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary host, no loader configured
        <img
          src={thumbnailUrl}
          alt={title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {children && <div className="relative h-full w-full">{children}</div>}
    </div>
  );
}
