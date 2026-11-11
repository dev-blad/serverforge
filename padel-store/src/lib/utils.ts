import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatOrderNumber(n: number): string {
  return `CL-${10000 + n}`;
}

/** Parse "CL-10042" or "10042" back into the stored sequence number. */
export function parseOrderNumber(input: string): number | null {
  const m = input.trim().toUpperCase().match(/^(?:CL-?)?(\d{5,})$/);
  if (!m) return null;
  const n = Number(m[1]) - 10000;
  return n > 0 ? n : null;
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", ...opts }).format(new Date(d));
}

export function absoluteUrl(path = "/") {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** UK postcode validation (permissive, covers standard formats + GIR 0AA). */
export const UK_POSTCODE = /^(GIR ?0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2})$/i;

export function normalisePostcode(pc: string): string {
  const clean = pc.toUpperCase().replace(/\s+/g, "");
  return clean.length > 3 ? `${clean.slice(0, -3)} ${clean.slice(-3)}` : clean;
}

export function randomCode(length = 8, alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
