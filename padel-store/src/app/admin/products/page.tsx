import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { FilterTabs, PageHeader, PlaceholderBadge, Table } from "@/components/admin/ui";

export const metadata = { title: "Products" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; category?: string }> }) {
  const sp = await searchParams;
  const where: Prisma.ProductWhereInput = {
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { variants: { some: { sku: { contains: sp.q, mode: "insensitive" } } } }] } : {}),
    ...(sp.filter === "placeholder" ? { isPlaceholder: true } : sp.filter === "real" ? { isPlaceholder: false } : {}),
    ...(sp.filter === "draft" ? { status: { not: "ACTIVE" } } : {}),
    ...(sp.category ? { category: { slug: sp.category } } : {}),
  };
  const [products, placeholderCount, total] = await Promise.all([
    db.product.findMany({ where, orderBy: [{ isPlaceholder: "asc" }, { category: { sortOrder: "asc" } }, { name: "asc" }], include: { category: true, brand: true, variants: true } }),
    db.product.count({ where: { isPlaceholder: true } }),
    db.product.count(),
  ]);
  return (
    <div>
      <PageHeader title="Products" description={`${total} products · ${placeholderCount} placeholders to swap for real stock`} actions={<Link href="/admin/products/new" className="btn-primary btn-sm">Add product</Link>} />
      <FilterTabs
        current={sp.filter ?? "all"}
        items={[
          { key: "all", label: "All", href: "/admin/products" },
          { key: "real", label: "Real stock", href: "/admin/products?filter=real" },
          { key: "placeholder", label: "Placeholders", href: "/admin/products?filter=placeholder", count: placeholderCount },
          { key: "draft", label: "Draft / archived", href: "/admin/products?filter=draft" },
        ]}
      />
      <form className="mb-4 flex gap-2">
        <label htmlFor="pq" className="sr-only">Search products</label>
        <input id="pq" name="q" defaultValue={sp.q} placeholder="Search name or SKU" className="input max-w-xs" />
        <button className="btn-outline btn-sm">Search</button>
      </form>
      <div className="card p-2">
        <Table head={["", "Product", "Category", "Price", "Stock", "Status", "Sold"]}>
          {products.map((p) => {
            const stock = p.variants.reduce((s, v) => s + v.stock, 0);
            return (
              <tr key={p.id} className="hover:bg-canvas">
                <td className="w-12 px-2 py-2"><div className="relative size-10 overflow-hidden rounded bg-canvas">{p.images[0] && <Image src={p.images[0]} alt="" fill sizes="40px" unoptimized />}</div></td>
                <td className="px-2"><Link href={`/admin/products/${p.id}`} className="font-semibold hover:underline">{p.name}</Link> {p.isPlaceholder && <PlaceholderBadge />}<br /><span className="text-xs text-muted">{p.brand?.name} · {p.variants.length} variant{p.variants.length === 1 ? "" : "s"}</span></td>
                <td className="px-2">{p.category.name}</td>
                <td className="px-2">{formatPrice(p.price)}</td>
                <td className={`px-2 font-semibold ${stock <= 0 ? "text-sale" : stock <= 5 ? "text-amber-700" : ""}`}>{stock}</td>
                <td className="px-2 text-xs">{p.status.toLowerCase()}</td>
                <td className="px-2">{p.salesCount}</td>
              </tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
