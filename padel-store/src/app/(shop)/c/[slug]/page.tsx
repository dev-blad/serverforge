import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SPECIAL_COLLECTIONS } from "@/lib/catalog";
import { ProductListing } from "@/components/listing/product-listing";
import { Breadcrumbs } from "@/components/listing/breadcrumbs";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function resolve(slug: string) {
  const special = SPECIAL_COLLECTIONS[slug];
  if (special) return { name: special.name, description: special.description, where: special.where };
  const cat = await db.category.findUnique({ where: { slug } });
  if (!cat) return null;
  return { name: cat.name, description: cat.description, where: { categoryId: cat.id } };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const c = await resolve(slug);
  if (!c) return {};
  const filtered = Object.keys(sp).some((k) => k !== "page");
  return {
    title: c.name,
    description: `${c.description} Free UK delivery over £50 and same-day dispatch.`,
    alternates: { canonical: `/c/${slug}` },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { title: c.name, description: c.description },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const c = await resolve(slug);
  if (!c) notFound();
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ name: c.name }]} />
      <header className="mt-4 max-w-3xl">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{c.name}</h1>
        <p className="mt-2 text-muted">{c.description}</p>
      </header>
      <ProductListing base={c.where} searchParams={sp} basePath={`/c/${slug}`} />
    </div>
  );
}
