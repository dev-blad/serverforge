import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { getFrequentlyBoughtTogether, getProductBySlug, getRelated, toCard, cardSelect } from "@/lib/catalog";
import { db } from "@/lib/db";
import { Breadcrumbs } from "@/components/listing/breadcrumbs";
import { Gallery } from "@/components/product/gallery";
import { AddToCart } from "@/components/product/add-to-cart";
import { DeliveryEstimate } from "@/components/product/delivery-estimate";
import { GuideDialog } from "@/components/product/guide-dialog";
import { Stars } from "@/components/ui/stars";
import { ReviewForm } from "@/components/product/review-form";
import { FrequentlyBoughtTogether } from "@/components/product/fbt";
import { ProductGrid } from "@/components/product/product-grid";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { store } from "@/lib/config";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const products = await db.product.findMany({ where: { status: "ACTIVE", OR: [{ isBestSeller: true }, { isFeatured: true }] }, select: { slug: true } });
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return {};
  return {
    title: `${p.name}${p.category.slug === "rackets" ? " Padel Racket" : ""}`,
    description: `${p.shortDescription} £${(p.price / 100).toFixed(2)} with free UK delivery over £50.`,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.name, description: p.shortDescription, type: "website" },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();

  const card = toCard((await db.product.findUnique({ where: { id: p.id }, select: cardSelect }))!);
  const [fbt, related, dist] = await Promise.all([
    getFrequentlyBoughtTogether(p.id, p.category.slug),
    getRelated(p.id, p.categoryId),
    db.review.groupBy({ by: ["rating"], where: { productId: p.id, status: "APPROVED" }, _count: true }),
  ]);
  const specs = (p.specs as { label: string; value: string }[]) ?? [];
  const variants = p.variants.map((v) => ({ id: v.id, name: v.name, price: v.price ?? p.price, stock: v.stock }));
  const inStock = variants.some((v) => v.stock > 0);
  const optionLabel = p.category.slug === "shoes" ? "UK size" : p.category.slug === "clothing" ? "Size" : p.category.slug === "balls" ? "Pack size" : "Option";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.shortDescription,
    image: p.images.map((i) => absoluteUrl(i)),
    sku: p.variants[0]?.sku,
    brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    category: p.category.name,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "GBP",
      lowPrice: (Math.min(...variants.map((v) => v.price)) / 100).toFixed(2),
      highPrice: (Math.max(...variants.map((v) => v.price)) / 100).toFixed(2),
      offerCount: variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/products/${p.slug}`),
      seller: { "@type": "Organization", name: store.name },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "GB" },
        shippingRate: { "@type": "MonetaryAmount", value: "3.99", currency: "GBP" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "GB",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 30,
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
    aggregateRating: p.ratingCount ? { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.ratingCount } : undefined,
    review: p.reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.authorName },
      datePublished: r.createdAt.toISOString().slice(0, 10),
      name: r.title,
      reviewBody: r.body,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
    })),
  };

  return (
    <div className="container-page py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={[{ name: p.category.name, href: `/c/${p.category.slug}` }, { name: p.name }]} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={p.images} name={p.name} />
        <div>
          {p.brand && <p className="text-sm font-semibold tracking-wide text-muted uppercase">{p.brand.name}</p>}
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{p.name}</h1>
          {p.ratingCount > 0 && (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm hover:underline">
              <Stars rating={p.ratingAvg} /> {p.ratingAvg.toFixed(1)} · {p.ratingCount} reviews
            </a>
          )}
          <p className="mt-4 text-ink/80">{p.shortDescription}</p>
          <div className="mt-6">
            <AddToCart productId={p.id} slug={p.slug} name={p.name} variants={variants} compareAtPrice={p.compareAtPrice} optionLabel={optionLabel} />
          </div>
          <div className="mt-5">
            <DeliveryEstimate cutoffHour={store.dispatchCutoffHour} />
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            {p.category.slug === "rackets" && <GuideDialog kind="racket" />}
            {(p.category.slug === "shoes" || p.category.slug === "clothing") && <GuideDialog kind="size" />}
          </div>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <li className="flex items-center gap-2"><Truck className="size-4 text-brand-600" aria-hidden /> Free delivery over £50</li>
            <li className="flex items-center gap-2"><RotateCcw className="size-4 text-brand-600" aria-hidden /> 30-day returns</li>
            <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand-600" aria-hidden /> 2-year warranty</li>
          </ul>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="desc-title">
          <h2 id="desc-title" className="text-xl font-extrabold">Description</h2>
          <div className="mt-3 space-y-3 text-ink/85">
            {p.description.split("\n\n").map((para) => (
              <p key={para.slice(0, 30)}>{para}</p>
            ))}
          </div>
          <details className="mt-6 rounded-lg border border-line p-4">
            <summary className="cursor-pointer font-semibold">Delivery & returns</summary>
            <div className="mt-3 space-y-2 text-sm text-ink/80">
              <p>Royal Mail Tracked 48 (£3.99) or Evri (£3.49) — free on orders over £50. Royal Mail Tracked 24 £5.99. Orders before 2pm Mon–Fri ship the same day.</p>
              <p>Changed your mind? Return unused items within 30 days for a full refund. Your statutory 14-day right to cancel is unaffected.</p>
            </div>
          </details>
        </section>
        {specs.length > 0 && (
          <section aria-labelledby="specs-title">
            <h2 id="specs-title" className="text-xl font-extrabold">Specifications</h2>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {specs.map((s) => (
                  <tr key={s.label} className="border-b border-line">
                    <th scope="row" className="w-2/5 py-2.5 pr-4 text-left font-medium text-muted">{s.label}</th>
                    <td className="py-2.5">{s.value}</td>
                  </tr>
                ))}
                <tr className="border-b border-line">
                  <th scope="row" className="py-2.5 pr-4 text-left font-medium text-muted">SKU</th>
                  <td className="py-2.5">{p.variants.map((v) => v.sku).join(", ")}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
      </div>

      {fbt.length > 0 && (
        <div className="mt-12">
          <FrequentlyBoughtTogether main={card} others={fbt} />
        </div>
      )}

      <section id="reviews" aria-labelledby="reviews-title" className="mt-12 scroll-mt-28">
        <h2 id="reviews-title" className="text-2xl font-extrabold">Customer reviews</h2>
        <div className="mt-4 grid gap-8 lg:grid-cols-[280px_1fr]">
          <div>
            {p.ratingCount > 0 ? (
              <>
                <p className="text-4xl font-extrabold">{p.ratingAvg.toFixed(1)}</p>
                <Stars rating={p.ratingAvg} size="md" />
                <p className="mt-1 text-sm text-muted">Based on {p.ratingCount} reviews</p>
                <ul className="mt-4 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const c = dist.find((d) => d.rating === n)?._count ?? 0;
                    return (
                      <li key={n} className="flex items-center gap-2 text-xs">
                        <span className="w-6">{n}★</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                          <span className="block h-full bg-amber-500" style={{ width: `${(c / p.ratingCount) * 100}%` }} />
                        </span>
                        <span className="w-6 text-right text-muted">{c}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted">No reviews yet — be the first.</p>
            )}
            <div className="mt-6">
              <ReviewForm productId={p.id} slug={p.slug} />
            </div>
          </div>
          <ul className="divide-y divide-line">
            {p.reviews.map((r) => (
              <li key={r.id} className="py-5 first:pt-0">
                <div className="flex items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="font-semibold">{r.title}</span>
                </div>
                <p className="mt-2 text-sm text-ink/85">{r.body}</p>
                <p className="mt-2 text-xs text-muted">
                  {r.authorName} · {formatDate(r.createdAt)} {r.verified && <span className="font-semibold text-brand-600">· Verified buyer</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="mt-14">
          <h2 id="related-title" className="mb-6 text-2xl font-extrabold">You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
      <RecentlyViewed exclude={p.slug} />
    </div>
  );
}
