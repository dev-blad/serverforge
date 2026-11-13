"use client";

const KEY = "cl_recent";

/** PECR: "recently viewed" isn't strictly necessary, so it's only stored with functional consent. */
function hasFunctionalConsent() {
  const m = document.cookie.match(/(?:^|; )cl_consent=([^;]*)/);
  if (!m) return false;
  try {
    return Boolean((JSON.parse(decodeURIComponent(m[1]!)) as { functional?: boolean }).functional);
  } catch {
    return false;
  }
}

export function pushRecentlyViewed(slug: string) {
  try {
    if (!hasFunctionalConsent()) return;
    const list = (JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]).filter((s) => s !== slug);
    localStorage.setItem(KEY, JSON.stringify([slug, ...list].slice(0, 12)));
  } catch {
    /* ignore */
  }
}

export function getRecentlyViewed(): string[] {
  try {
    if (!hasFunctionalConsent()) return [];
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function clearRecentlyViewed() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
