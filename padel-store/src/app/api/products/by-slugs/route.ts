import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardSelect, toCard } from "@/lib/catalog";

/** Resolve product cards by slugs or ids (used by recently viewed + wishlist). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const slugs = (sp.get("slugs") ?? "").split(",").filter(Boolean).slice(0, 24);
  const ids = (sp.get("ids") ?? "").split(",").filter(Boolean).slice(0, 60);
  if (!slugs.length && !ids.length) return NextResponse.json({ items: [] });
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", OR: [{ slug: { in: slugs } }, { id: { in: ids } }] },
    select: cardSelect,
  });
  const order = slugs.length ? slugs : ids;
  const items = order
    .map((k) => rows.find((r) => r.slug === k || r.id === k))
    .filter(Boolean)
    .map((r) => toCard(r!));
  return NextResponse.json({ items });
}
