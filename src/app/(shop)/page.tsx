import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getNavCategories, getProductsBy } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/product-grid";
import { TrustBadges } from "@/components/home/trust-badges";
import { SectionHeading } from "@/components/home/section-heading";
import { Stars } from "@/components/ui/stars";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { store } from "@/lib/config";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 600;

export default async function HomePage() {
  const [categories, featured, bestSellers, newArrivals, reviews, agg] = await Promise.all([
    getNavCategories(),
    getProductsBy({ isFeatured: true }, [{ salesCount: "desc" }], 4),
    getProductsBy({ isBestSeller: true }, [{ salesCount: "desc" }], 8),
    getProductsBy({}, [{ isNew: "desc" }, { createdAt: "desc" }], 4),
    db.review.findMany({
      where: { status: "APPROVED", rating: 5 },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { product: { select: { name: true, slug: true } } },
    }).then((rs) => rs.filter((r, i) => rs.findIndex((x) => x.title === r.title) === i).slice(0, 3)),
    db.review.aggregate({ where: { status: "APPROVED" }, _avg: { rating: true }, _count: true }),
  ]);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: store.name,
    url: absoluteUrl("/"),
    email: store.email,
    address: { "@type": "PostalAddress", streetAddress: store.address, addressCountry: "GB" },
    aggregateRating: agg._count ? { "@type": "AggregateRating", ratingValue: (agg._avg.rating ?? 0).toFixed(1), reviewCount: agg._count } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div className="container-page grid items-center gap-8 py-12 md:grid-cols-2 md:py-16 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-lime-accent">
              <Sparkles className="size-3.5" aria-hidden /> New season rackets just landed
            </p>
            <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-6xl">
              Kit that wins <span className="text-lime-accent">the point.</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-white/80">
              Padel rackets for every level and tour-grade balls by the tube or box — picked by players, shipped fast across the UK.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/c/rackets" className="btn-accent">
                Shop rackets <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/racket-finder" className="btn border border-white/30 text-white hover:bg-white/10">
                Find my racket
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-3 text-sm text-white/80">
              <Stars rating={agg._avg.rating ?? 0} />
              <span>
                {(agg._avg.rating ?? 0).toFixed(1)}/5 from {agg._count} verified reviews
              </span>
            </div>
          </div>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-xl">
            <Image src="/images/hero.svg" alt="Padel racket and ball on a blue padel court with glass walls" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="rounded-2xl object-cover" unoptimized />
          </div>
        </div>
      </section>

      <TrustBadges />

      <section aria-labelledby="cat-title" className="container-page py-12">
        <SectionHeading id="cat-title" title="Shop by category" eyebrow="Everything for padel" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/c/${c.slug}`} className="group block overflow-hidden rounded-xl border border-line bg-canvas">
                <div className="relative aspect-[4/3]">
                  {c.image && <Image src={c.image} alt="" fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover transition group-hover:scale-105" unoptimized />}
                </div>
                <div className="flex items-center justify-between bg-white px-3 py-3">
                  <span className="text-sm font-bold">{c.name}</span>
                  <span className="text-xs text-muted">{c._count.products}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="featured-title" className="container-page py-6">
        <SectionHeading id="featured-title" title="Featured rackets & kit" eyebrow="Staff picks" href="/c/all" />
        <ProductGrid products={featured} />
      </section>

      <section className="container-page py-12">
        <div className="grid overflow-hidden rounded-2xl bg-lime-accent md:grid-cols-2">
          <div className="p-8 md:p-12">
            <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">Racket finder</p>
            <h2 className="mt-2 text-3xl font-extrabold text-brand-950">Find your perfect racket in 60 seconds</h2>
            <p className="mt-3 text-brand-900/80">Tell us your level, style and any arm niggles — we&apos;ll match you with rackets that suit your game.</p>
            <Link href="/racket-finder" className="btn-primary mt-6">
              Start the quiz <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="relative min-h-56">
            <Image src="/images/products/vantis-hybrid-teardrop-2.svg" alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" unoptimized />
          </div>
        </div>
      </section>

      <section aria-labelledby="best-title" className="container-page py-6">
        <SectionHeading id="best-title" title="Best sellers" eyebrow="Customer favourites" href="/c/best-sellers" />
        <ProductGrid products={bestSellers} />
      </section>

      <section aria-labelledby="new-title" className="container-page py-12">
        <SectionHeading id="new-title" title="New arrivals" eyebrow="Just landed" href="/c/new" />
        <ProductGrid products={newArrivals} />
      </section>

      <section aria-labelledby="reviews-title" className="bg-canvas py-14">
        <div className="container-page">
          <SectionHeading id="reviews-title" title="What players say" eyebrow={`${(agg._avg.rating ?? 0).toFixed(1)} ★ average from ${agg._count} reviews`} />
          <ul className="grid gap-4 md:grid-cols-3">
            {reviews.map((r) => (
              <li key={r.id} className="card p-6">
                <Stars rating={r.rating} />
                <p className="mt-3 font-semibold">“{r.title}”</p>
                <p className="mt-2 line-clamp-4 text-sm text-muted">{r.body}</p>
                <p className="mt-4 text-xs text-muted">
                  {r.authorName} {r.verified && <span className="font-semibold text-brand-600">· Verified buyer</span>} ·{" "}
                  <Link href={`/products/${r.product.slug}`} className="underline">
                    {r.product.name}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-brand-900 p-8 text-white">
            <MapPin className="size-8 text-lime-accent" aria-hidden />
            <h2 className="mt-3 text-2xl font-extrabold">Find a game near you</h2>
            <p className="mt-2 text-white/80">Browse courts across the UK and post on our community board to find players at your level.</p>
            <Link href="/find-a-game" className="btn-accent mt-6">
              Find players
            </Link>
          </div>
          <div className="rounded-2xl border border-line p-8">
            <h2 className="text-2xl font-extrabold">Join the Courtline club</h2>
            <p className="mt-2 text-muted">New drops, restock alerts and 10% off your first order.</p>
            <div className="mt-5">
              <NewsletterForm source="home" />
            </div>
          </div>
        </div>
      </section>

      <RecentlyViewed />
    </>
  );
}
