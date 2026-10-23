"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

export default function VerifyLandingPage() {
  const router = useRouter();
  const [serial, setSerial] = useState("");

  useEffect(() => {
    document.title = "Verify a Certificate | Elevate";
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = serial.trim().toUpperCase();
    if (trimmed) router.push(`/verify/${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary-50/60 via-white to-white">
      {/* soft decorative glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-200/40 blur-3xl"
        aria-hidden="true"
      />

      <div className="section-container relative flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-primary-700 backdrop-blur">
          <Sparkles size={13} />
          Credential registry
        </span>

        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/25">
          <ShieldCheck size={30} />
        </div>

        <h1
          className="heading-2 mt-6 text-neutral-900"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Verify a certificate
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-neutral-500">
          Every Elevate certificate carries a unique serial number. Enter it
          below to confirm the credential is authentic — no account needed.
        </p>

        <form onSubmit={onSubmit} className="mx-auto mt-8 w-full max-w-md">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="e.g. TT-2026-AB12CD"
              aria-label="Certificate serial number"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-center text-sm font-medium tracking-wide text-neutral-800 uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 sm:text-left"
            />
            <button
              type="submit"
              disabled={!serial.trim()}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Verify
              <ArrowRight size={16} />
            </button>
          </div>
        </form>

        <p className="mt-6 text-xs text-neutral-400">
          Tip: the serial is printed at the bottom of the certificate.
        </p>
      </div>
    </section>
  );
}
