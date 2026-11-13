"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface Consent {
  v: 1;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
  ts: string;
}

const COOKIE = "cl_consent";

function readConsent(): Consent | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  if (!m) return null;
  try {
    const c = JSON.parse(decodeURIComponent(m[1]!)) as Consent;
    return c.v === 1 ? c : null;
  } catch {
    return null;
  }
}

interface ConsentContextValue {
  consent: Consent | null;
  ready: boolean;
  bannerOpen: boolean;
  openPreferences: () => void;
  save: (c: Omit<Consent, "v" | "ts">) => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

/**
 * UK GDPR / PECR consent: nothing non-essential loads until the visitor opts in.
 * Choice stored for 6 months in a strictly-necessary first-party cookie.
 */
export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    const c = readConsent();
    setConsent(c);
    setBannerOpen(!c);
    setReady(true);
  }, []);

  const save = useCallback((c: Omit<Consent, "v" | "ts">) => {
    const full: Consent = { v: 1, ...c, ts: new Date().toISOString() };
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(full))}; Max-Age=${60 * 60 * 24 * 182}; Path=/; SameSite=Lax${secure}`;
    const withdrawn = consent && ((consent.analytics && !c.analytics) || (consent.functional && !c.functional));
    setConsent(full);
    setBannerOpen(false);
    if (!c.functional) {
      try {
        localStorage.removeItem("cl_recent");
      } catch {
        /* ignore */
      }
    }
    // Already-loaded third-party scripts can only be removed by reloading.
    if (withdrawn) location.reload();
  }, [consent]);

  const value = useMemo(
    () => ({ consent, ready, bannerOpen, openPreferences: () => setBannerOpen(true), save }),
    [consent, ready, bannerOpen, save],
  );
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used inside ConsentProvider");
  return ctx;
}
