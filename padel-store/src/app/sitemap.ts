import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { POLICIES } from "@/content/policies";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true, images: true } }),
    db.category.findMany({ select: { slug: true } }),
  ]);
  const staticPages = ["/", "/c/all", "/c/new", "/c/sale", "/c/best-sellers", "/racket-finder", "/find-a-game", "/help", "/contact", "/returns", "/track", "/gift-cards"];
  return [
    ...staticPages.map((p) => ({ url: absoluteUrl(p), changeFrequency: "weekly" as const, priority: p === "/" ? 1 : 0.6 })),
    ...categories.map((c) => ({ url: absoluteUrl(`/c/${c.slug}`), changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: absoluteUrl(`/products/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7, images: p.images.map((i) => absoluteUrl(i)) })),
    ...POLICIES.map((p) => ({ url: absoluteUrl(`/policies/${p.slug}`), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
