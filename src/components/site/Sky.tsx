/**
 * The lilac sky the public pages open on, with soft clouds drifting at its
 * edges. Decorative only: every cloud is aria-hidden and the sky never carries
 * meaning. The navbar floats over any page that starts with one, so the
 * content starts below a 7rem top pad.
 */
export function Clouds({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <span className="xw-cloud xw-drift -left-24 top-40 h-40 w-[26rem] sm:h-52 sm:w-[34rem]" />
      <span className="xw-cloud xw-drift -right-28 top-24 h-36 w-[24rem] [animation-delay:-6s] sm:h-48 sm:w-[32rem]" />
      <span className="xw-cloud -left-10 top-[58%] hidden h-44 w-[30rem] opacity-80 lg:block" />
      <span className="xw-cloud -right-16 top-[62%] hidden h-40 w-[28rem] opacity-80 lg:block" />
    </div>
  );
}

export function Sky({
  children,
  className = "",
  clouds = true,
}: {
  children: React.ReactNode;
  className?: string;
  clouds?: boolean;
}) {
  return (
    <section className={`xw-sky relative isolate overflow-hidden pt-28 sm:pt-32 ${className}`}>
      {clouds && <Clouds className="-z-10" />}
      {children}
    </section>
  );
}
