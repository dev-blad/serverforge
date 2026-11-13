import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchWhere } from "@/lib/catalog";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ products: [], categories: [] });
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE", ...searchWhere(q) },
      orderBy: [{ salesCount: "desc" }],
      take: 6,
      select: { slug: true, name: true, price: true, images: true, brand: { select: { name: true } } },
    }),
    db.category.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { slug: true, name: true }, take: 3 }),
  ]);
  return NextResponse.json(
    { products: products.map((p) => ({ slug: p.slug, name: p.name, price: p.price, image: p.images[0], brand: p.brand?.name })), categories },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
