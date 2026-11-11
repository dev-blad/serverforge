import type { Metadata } from "next";
import { ProductListing } from "@/components/listing/product-listing";
import { Breadcrumbs } from "@/components/listing/breadcrumbs";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Search: ${String(q)}` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ name: "Search" }]} />
      <h1 className="mt-4 text-3xl font-extrabold">{q ? <>Results for “{q}”</> : "Search our shop"}</h1>
      <form action="/search" className="mt-4 flex max-w-lg gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input id="q" name="q" defaultValue={q} className="input" placeholder="Search rackets, balls, brands…" />
        <button className="btn-primary">Search</button>
      </form>
      <ProductListing base={{}} searchParams={sp} basePath="/search" />
    </div>
  );
}
