"use client";

const KEY = "cl_recent";
export function pushRecentlyViewed(slug: string) {
  try {
    const list = (JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]).filter((s) => s !== slug);
    localStorage.setItem(KEY, JSON.stringify([slug, ...list].slice(0, 12)));
  } catch {
    /* ignore */
  }
}
export function getRecentlyViewed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
