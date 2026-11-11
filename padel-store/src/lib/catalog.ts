import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const PAGE_SIZE = 12;

export const cardSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  compareAtPrice: true,
  images: true,
  ratingAvg: true,
  ratingCount: true,
  isNew: true,
  isBestSeller: true,
  shortDescription: true,
  brand: { select: { name: true } },
  category: { select: { slug: true } },
  variants: { select: { id: true, name: true, stock: true, price: true }, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductSelect;

export type CardProduct = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  compareAtPrice: number | null;
  image: string;
  imageAlt: string | null;
  ratingAvg: number;
  ratingCount: number;
  isNew: boolean;
  isBestSeller: boolean;
  totalStock: number;
  singleVariantId: string | null;
  /** First in-stock variant (used by bundle add-to-basket) */
  defaultVariantId: string | null;
  defaultVariantName: string | null;
  defaultVariantPrice: number;
  variantCount: number;
}

export function toCard(p: CardProduct): ProductCardData {
  const prices = p.variants.map((v) => v.price ?? p.price);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand?.name ?? null,
    price: prices.length ? Math.min(...prices) : p.price,
    compareAtPrice: p.compareAtPrice,
    image: p.images[0] ?? "/images/placeholder.svg",
    imageAlt: p.images[1] ?? null,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    isNew: p.isNew,
    isBestSeller: p.isBestSeller,
    totalStock: p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0),
    singleVariantId: p.variants.length === 1 ? p.variants[0]!.id : null,
    defaultVariantId: (p.variants.find((v) => v.stock > 0) ?? null)?.id ?? null,
    defaultVariantName: (p.variants.find((v) => v.stock > 0) ?? null)?.name ?? null,
    defaultVariantPrice: (() => { const d = p.variants.find((v) => v.stock > 0); return d ? (d.price ?? p.price) : p.price; })(),
    variantCount: p.variants.length,
  };
}

const active = { status: "ACTIVE" } satisfies Prisma.ProductWhereInput;

export const getNavCategories = unstable_cache(
  async () =>
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, description: true, image: true, _count: { select: { products: { where: active } } } },
    }),
  ["nav-categories"],
  { revalidate: 300, tags: ["catalog"] },
);

export const getBrands = unstable_cache(async () => db.brand.findMany({ orderBy: { name: "asc" } }), ["brands"], {
  revalidate: 300,
  tags: ["catalog"],
});

export async function getProductsBy(where: Prisma.ProductWhereInput, orderBy: Prisma.ProductOrderByWithRelationInput[], take = 8) {
  const rows = await db.product.findMany({ where: { ...active, ...where }, orderBy, take, select: cardSelect });
  return rows.map(toCard);
}

export const SPECIAL_COLLECTIONS: Record<string, { name: string; description: string; where: Prisma.ProductWhereInput }> = {
  all: { name: "Shop all", description: "Every racket, ball and accessory we stock.", where: {} },
  sale: { name: "Sale", description: "Reduced prices on selected rackets and kit — while stocks last.", where: { compareAtPrice: { not: null } } },
  new: { name: "New arrivals", description: "The latest kit to land in our warehouse.", where: { isNew: true } },
  "best-sellers": { name: "Best sellers", description: "Our customers' favourites.", where: { isBestSeller: true } },
};

export interface ListingFilters {
  brand: string[];
  shape: string[];
  level: string[];
  balance: string[];
  weight: string[];
  price: string[];
  inStock: boolean;
}

export const WEIGHT_BUCKETS: Record<string, { label: string; gte?: number; lt?: number }> = {
  "under-350": { label: "Under 350 g", lt: 350 },
  "350-359": { label: "350–359 g", gte: 350, lt: 360 },
  "360-369": { label: "360–369 g", gte: 360, lt: 370 },
  "370-plus": { label: "370 g +", gte: 370 },
};

export const PRICE_BUCKETS: Record<string, { label: string; gte?: number; lt?: number }> = {
  "under-25": { label: "Under £25", lt: 2500 },
  "25-75": { label: "£25 – £75", gte: 2500, lt: 7500 },
  "75-150": { label: "£75 – £150", gte: 7500, lt: 15000 },
  "150-plus": { label: "£150 +", gte: 15000 },
};

export const SORTS = {
  featured: { label: "Featured", orderBy: [{ isFeatured: "desc" }, { salesCount: "desc" }] },
  "best-selling": { label: "Best selling", orderBy: [{ salesCount: "desc" }] },
  newest: { label: "Newest", orderBy: [{ createdAt: "desc" }] },
  "price-asc": { label: "Price: low to high", orderBy: [{ price: "asc" }] },
  "price-desc": { label: "Price: high to low", orderBy: [{ price: "desc" }] },
  rating: { label: "Top rated", orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }] },
} satisfies Record<string, { label: string; orderBy: Prisma.ProductOrderByWithRelationInput[] }>;

export type SortKey = keyof typeof SORTS;

function arr(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : v.split(",")).filter(Boolean);
}

export function parseListingParams(sp: Record<string, string | string[] | undefined>) {
  const filters: ListingFilters = {
    brand: arr(sp.brand),
    shape: arr(sp.shape),
    level: arr(sp.level),
    balance: arr(sp.balance),
    weight: arr(sp.weight),
    price: arr(sp.price),
    inStock: sp.inStock === "1",
  };
  const sortRaw = typeof sp.sort === "string" ? sp.sort : "featured";
  const sort: SortKey = sortRaw in SORTS ? (sortRaw as SortKey) : "featured";
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  return { filters, sort, page, q };
}

function bucketWhere(field: "price" | "weightGrams", keys: string[], buckets: Record<string, { gte?: number; lt?: number }>) {
  const ors = keys.filter((k) => buckets[k]).map((k) => ({ [field]: { gte: buckets[k]!.gte, lt: buckets[k]!.lt } }));
  return ors.length ? { OR: ors } : {};
}

export function searchWhere(q: string): Prisma.ProductWhereInput {
  if (!q) return {};
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    AND: terms.map((t) => ({
      OR: [
        { name: { contains: t, mode: "insensitive" } },
        { shortDescription: { contains: t, mode: "insensitive" } },
        { brand: { name: { contains: t, mode: "insensitive" } } },
        { category: { name: { contains: t, mode: "insensitive" } } },
        { shape: { contains: t, mode: "insensitive" } },
      ],
    })),
  };
}

export async function listProducts(base: Prisma.ProductWhereInput, params: ReturnType<typeof parseListingParams>) {
  const { filters, sort, page, q } = params;
  const baseWhere: Prisma.ProductWhereInput = { ...active, ...base, ...searchWhere(q) };
  const where: Prisma.ProductWhereInput = {
    AND: [
      baseWhere,
      filters.brand.length ? { brand: { slug: { in: filters.brand } } } : {},
      filters.shape.length ? { shape: { in: filters.shape } } : {},
      filters.level.length ? { skillLevel: { in: filters.level } } : {},
      filters.balance.length ? { balance: { in: filters.balance } } : {},
      bucketWhere("weightGrams", filters.weight, WEIGHT_BUCKETS),
      bucketWhere("price", filters.price, PRICE_BUCKETS),
      filters.inStock ? { variants: { some: { stock: { gt: 0 } } } } : {},
    ],
  };

  const [total, rows, facetRows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [...SORTS[sort].orderBy, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: cardSelect,
    }),
    db.product.findMany({
      where: baseWhere,
      select: { price: true, weightGrams: true, shape: true, skillLevel: true, balance: true, brand: { select: { slug: true, name: true } } },
    }),
  ]);

  const count = <T extends string>(values: (T | null | undefined)[]) => {
    const m = new Map<string, number>();
    for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].map(([value, n]) => ({ value, label: value, count: n }));
  };
  const bucketCount = (field: "price" | "weightGrams", buckets: Record<string, { label: string; gte?: number; lt?: number }>) =>
    Object.entries(buckets)
      .map(([value, b]) => ({
        value,
        label: b.label,
        count: facetRows.filter((r) => {
          const x = r[field];
          return x != null && (b.gte === undefined || x >= b.gte) && (b.lt === undefined || x < b.lt);
        }).length,
      }))
      .filter((f) => f.count > 0);

  const brandMap = new Map<string, { value: string; label: string; count: number }>();
  for (const r of facetRows) {
    if (!r.brand) continue;
    const e = brandMap.get(r.brand.slug) ?? { value: r.brand.slug, label: r.brand.name, count: 0 };
    e.count++;
    brandMap.set(r.brand.slug, e);
  }
  const order = (vals: { value: string; label: string; count: number }[], pref: string[]) =>
    vals.sort((a, b) => (pref.indexOf(a.value) + 99) % 99 - ((pref.indexOf(b.value) + 99) % 99) || a.label.localeCompare(b.label));

  const facets = [
    { key: "brand", label: "Brand", options: [...brandMap.values()].sort((a, b) => a.label.localeCompare(b.label)) },
    { key: "price", label: "Price", options: bucketCount("price", PRICE_BUCKETS) },
    { key: "level", label: "Skill level", options: order(count(facetRows.map((r) => r.skillLevel)), ["Beginner", "Intermediate", "Advanced", "Junior"]) },
    { key: "shape", label: "Shape", options: order(count(facetRows.map((r) => r.shape)), ["Round", "Teardrop", "Diamond"]) },
    { key: "balance", label: "Balance", options: order(count(facetRows.map((r) => r.balance)), ["Low", "Medium", "High"]) },
    { key: "weight", label: "Weight", options: bucketCount("weightGrams", WEIGHT_BUCKETS) },
  ].filter((f) => f.options.length > 0);

  return {
    items: rows.map(toCard),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    facets,
  };
}

export async function getProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      brand: true,
      category: true,
      variants: { orderBy: { sortOrder: "asc" } },
      reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

/** Frequently bought together: products co-occurring in past orders, with sensible fallbacks. */
export async function getFrequentlyBoughtTogether(productId: string, categorySlug: string, take = 3) {
  const rows = await db.$queryRaw<{ productId: string; n: bigint }[]>`
    SELECT oi2."productId", COUNT(*) AS n
    FROM "OrderItem" oi1
    JOIN "OrderItem" oi2 ON oi1."orderId" = oi2."orderId" AND oi2."productId" <> oi1."productId"
    JOIN "Product" p ON p.id = oi2."productId"
    WHERE oi1."productId" = ${productId} AND p.status = 'ACTIVE'
    GROUP BY oi2."productId" ORDER BY n DESC LIMIT ${take}`;
  const ids = rows.map((r) => r.productId);
  const complements: Record<string, string[]> = {
    rackets: ["balls", "grips-overgrips", "protectors", "bags"],
    balls: ["rackets", "accessories"],
    shoes: ["clothing", "accessories"],
  };
  if (ids.length < take) {
    const extra = await db.product.findMany({
      where: { ...active, id: { notIn: [productId, ...ids] }, category: { slug: { in: complements[categorySlug] ?? ["balls", "grips-overgrips"] } } },
      orderBy: [{ isBestSeller: "desc" }, { salesCount: "desc" }],
      take: take - ids.length,
      select: { id: true },
    });
    ids.push(...extra.map((e) => e.id));
  }
  const products = await db.product.findMany({ where: { id: { in: ids } }, select: cardSelect });
  return ids.map((id) => products.find((p) => p.id === id)).filter(Boolean).map((p) => toCard(p!));
}

export async function getRelated(productId: string, categoryId: string, take = 4) {
  return getProductsBy({ categoryId, id: { not: productId } }, [{ isBestSeller: "desc" }, { ratingAvg: "desc" }], take);
}
