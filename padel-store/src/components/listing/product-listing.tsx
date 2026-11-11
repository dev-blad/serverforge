import type { Prisma } from "@prisma/client";
import { listProducts, parseListingParams, SORTS } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/product-grid";
import { ActiveFilters, FilterSidebar, MobileFilters, SortSelect } from "./filters";
import { Pagination } from "./pagination";

export async function ProductListing({
  base,
  searchParams,
  basePath,
}: {
  base: Prisma.ProductWhereInput;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  const params = parseListingParams(searchParams);
  const result = await listProducts(base, params);
  const sorts = Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label }));
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[220px_1fr]">
      <FilterSidebar facets={result.facets} />
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {result.total} product{result.total === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <MobileFilters facets={result.facets} total={result.total} />
            <SortSelect sorts={sorts} current={params.sort} />
          </div>
        </div>
        <div className="mb-4">
          <ActiveFilters facets={result.facets} />
        </div>
        {result.items.length ? (
          <ProductGrid products={result.items} priorityCount={4} />
        ) : (
          <div className="card p-10 text-center">
            <p className="font-semibold">No products match those filters.</p>
            <p className="mt-1 text-sm text-muted">Try removing a filter or two.</p>
          </div>
        )}
        <Pagination page={result.page} pageCount={result.pageCount} basePath={basePath} params={searchParams} />
      </div>
    </div>
  );
}
