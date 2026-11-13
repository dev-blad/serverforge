"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useConsent } from "@/components/providers/consent-provider";

export function CookieBanner() {
  const { consent, bannerOpen, ready, save } = useConsent();
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (bannerOpen) {
      setAnalytics(consent?.analytics ?? false);
      setFunctional(consent?.functional ?? false);
      setMarketing(consent?.marketing ?? false);
      setCustom(Boolean(consent));
    }
  }, [bannerOpen, consent]);

  // Before hydration the banner is server-rendered for everyone (fast paint, no layout shift);
  // an inline script hides it pre-paint when a consent cookie already exists.
  if (ready && !bannerOpen) return null;

  return (
    <div id="cookie-banner" data-initial={ready ? undefined : ""} role="dialog" aria-modal="false" aria-labelledby="cookie-title" className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-5 shadow-2xl">
        <h2 id="cookie-title" ref={headingRef} className="text-base font-bold">
          Your privacy choices
        </h2>
        <p className="mt-1 text-sm text-muted">
          We use strictly necessary cookies to run the shop (basket, sign-in, security). With your permission we&apos;d also like to use
          analytics to improve the site and functional cookies for live chat. Nothing optional is loaded unless you say yes.{" "}
          <Link href="/policies/cookies" className="font-medium text-brand-700 underline">
            Cookie policy
          </Link>
        </p>

        {custom && (
          <fieldset className="mt-4 space-y-3 text-sm">
            <legend className="sr-only">Cookie categories</legend>
            <label className="flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-1 size-4" />
              <span>
                <strong>Strictly necessary</strong> — always on. Basket, checkout, sign-in, security and remembering this choice.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-4 accent-brand-900" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
              <span>
                <strong>Analytics</strong> — anonymous traffic statistics (Vercel Web Analytics / Plausible).
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-4 accent-brand-900" checked={functional} onChange={(e) => setFunctional(e.target.checked)} />
              <span>
                <strong>Functional</strong> — “recently viewed” products and third-party live chat (if enabled).
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-4 accent-brand-900" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>
                <strong>Marketing</strong> — measuring ad campaigns. We don&apos;t currently use any marketing cookies.
              </span>
            </label>
          </fieldset>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" className="btn-primary flex-1" onClick={() => save({ analytics: true, functional: true, marketing: true })}>
            Accept all
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => save({ analytics: false, functional: false, marketing: false })}>
            Reject all
          </button>
          {custom ? (
            <button type="button" className="btn-outline flex-1" onClick={() => save({ analytics, functional, marketing })}>
              Save choices
            </button>
          ) : (
            <button type="button" className="btn-outline flex-1" onClick={() => setCustom(true)}>
              Manage preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsLink({ className }: { className?: string }) {
  const { openPreferences } = useConsent();
  return (
    <button type="button" onClick={openPreferences} className={className}>
      Cookie settings
    </button>
  );
}
