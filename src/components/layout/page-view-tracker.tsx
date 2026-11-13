"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** First-party cookieless page-view counter (no device storage → no consent needed). */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const body = JSON.stringify({ type: "page_view", path: pathname });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    else void fetch("/api/analytics", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  }, [pathname]);
  return null;
}
