"use client";

/**
 * The last line of defence: catches errors thrown by the root layout itself,
 * which `app/error.tsx` cannot — it renders *inside* that layout.
 *
 * Because it replaces the root layout, it has to supply its own <html> and
 * <body>, and it cannot rely on the app's fonts, Tailwind theme tokens or
 * providers being available. Everything here is therefore inline and
 * self-contained, using the literal hex values from the design system rather
 * than the token classes.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#0f172a",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div role="alert" style={{ maxWidth: "32rem", textAlign: "center" }}>
          <div
            aria-hidden="true"
            style={{
              width: "3.5rem",
              height: "3.5rem",
              margin: "0 auto 1.5rem",
              borderRadius: "1rem",
              background: "rgba(239, 68, 68, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>

          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
            Elevate didn&apos;t start
          </h1>

          <p style={{ marginTop: "0.75rem", color: "#475569", lineHeight: 1.6 }}>
            The application failed to load. Reloading usually clears it. If it keeps happening, the
            reference below will tell our team where to look.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#0a3f44",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload Elevate
          </button>

          {error.digest && (
            <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#94a3b8" }}>
              Reference{" "}
              <span style={{ fontFamily: "ui-monospace, monospace", color: "#64748b" }}>
                {error.digest}
              </span>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
