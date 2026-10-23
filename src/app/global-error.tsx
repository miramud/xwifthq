"use client";

/**
 * The last line of defence: catches errors thrown by the root layout itself,
 * which `app/error.tsx` cannot, because it renders *inside* that layout.
 *
 * Because it replaces the root layout, it has to supply its own <html> and
 * <body>, and it cannot rely on the app's fonts, Tailwind theme tokens or
 * providers being available. Everything here is therefore inline and
 * self-contained: the XwiftHQ purples are literal hex values copied from the
 * design tokens, the sky is a plain CSS gradient, and the one rule inline
 * styles cannot express (a visible keyboard focus ring) lives in a small
 * <style> block below.
 */

const PURPLE = "#9638CD";
const PURPLE_DARK = "#7E2CAE";
const LILAC = "#E2C6F7";
const INK = "#10121F";
const MUTED = "#4B5163";

const CSS = `
  .xw-ge-btn { transition: background-color .15s ease; }
  .xw-ge-btn:hover { background: ${PURPLE_DARK} !important; }
  .xw-ge-btn:focus { outline: none; }
  .xw-ge-btn:focus-visible { outline: 3px solid ${LILAC}; outline-offset: 3px; }
  .xw-ge-link:focus-visible { outline: 2px solid ${PURPLE}; outline-offset: 3px; border-radius: 6px; }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>XwiftHQ didn&apos;t load</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{CSS}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          padding: "1.5rem 1rem",
          color: INK,
          fontFamily: "Poppins, Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background:
            "radial-gradient(60rem 30rem at 50% -8rem, rgba(217, 200, 236, 0.75), transparent 70%), linear-gradient(180deg, #F1EAF8 0%, #F6F2FA 45%, #FFFFFF 100%)",
        }}
      >
        <div
          role="alert"
          style={{
            width: "100%",
            maxWidth: "32rem",
            boxSizing: "border-box",
            textAlign: "center",
            background: "#FFFFFF",
            borderRadius: "1.25rem",
            border: "1px solid rgba(228, 230, 239, 0.9)",
            boxShadow: "0 1px 2px rgba(16, 18, 31, 0.04), 0 40px 80px -36px rgba(150, 56, 205, 0.45)",
            padding: "2.5rem 1.5rem",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ display: "block", margin: "0 auto" }}>
            <rect width="40" height="40" rx="11" fill={PURPLE} />
            <g strokeWidth="5" strokeLinecap="round">
              <path d="M30 10L25 15" stroke={LILAC} />
              <path d="M15 25L10 30" stroke={LILAC} />
              <path d="M11 11L29 29" stroke="#FFFFFF" />
            </g>
          </svg>

          <h1
            style={{
              fontSize: "1.75rem",
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              margin: "1.5rem 0 0",
            }}
          >
            XwiftHQ didn&apos;t start
          </h1>

          <p style={{ margin: "0.875rem auto 0", maxWidth: "26rem", color: MUTED, lineHeight: 1.6, fontSize: "0.95rem" }}>
            The app hit a problem before it could finish loading. A reload usually sorts it out. If it keeps
            happening, send our team the reference below so they know where to look.
          </p>

          <button
            type="button"
            onClick={reset}
            className="xw-ge-btn"
            style={{
              marginTop: "2rem",
              padding: "0.8rem 1.75rem",
              borderRadius: "9999px",
              border: "none",
              background: PURPLE,
              color: "#FFFFFF",
              fontSize: "0.875rem",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              boxShadow: "0 10px 24px -10px rgba(150, 56, 205, 0.7)",
            }}
          >
            Reload XwiftHQ
          </button>

          {error.digest && (
            <p style={{ margin: "2rem 0 0", fontSize: "0.75rem", color: MUTED, wordBreak: "break-all" }}>
              Reference{" "}
              <span style={{ fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace", color: INK }}>
                {error.digest}
              </span>
            </p>
          )}

          <p style={{ margin: "1.5rem 0 0", fontSize: "0.8rem" }}>
            {/* A plain anchor on purpose: a full page load is the way out when the root layout itself failed. */}            <a href="/support" className="xw-ge-link" style={{ color: PURPLE, fontWeight: 600, textDecoration: "none" }}>
              Contact XwiftHQ support
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
