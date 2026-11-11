import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

const BOT = /bot|crawl|spider|slurp|lighthouse|headless|preview|monitor/i;

/**
 * Privacy-friendly, cookieless visitor id: SHA-256 of (secret + date + IP + UA).
 * The salt rotates daily, so visitors cannot be tracked across days and no
 * identifier is stored on the device (no PECR consent required).
 */
export function visitorHash(req: Request, date = new Date()): string | null {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return null;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
  const day = date.toISOString().slice(0, 10);
  const secret = process.env.ANALYTICS_SALT ?? process.env.AUTH_SECRET ?? "salt";
  return createHash("sha256").update(`${secret}|${day}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

export type AnalyticsType = "page_view" | "product_view" | "add_to_cart" | "checkout_started" | "purchase";

export async function trackEvent(req: Request, e: { type: AnalyticsType; path?: string; productId?: string }) {
  try {
    const hash = visitorHash(req);
    if (!hash) return;
    await db.analyticsEvent.create({ data: { type: e.type, path: e.path?.slice(0, 300), productId: e.productId, visitorHash: hash } });
  } catch (err) {
    console.error("[analytics] failed", err);
  }
}
