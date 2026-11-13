import Link from "next/link";
import { db } from "@/lib/db";
import { saveStock } from "@/app/actions/admin-catalog";
import { PageHeader, PlaceholderBadge, Table } from "@/components/admin/ui";

export const metadata = { title: "Stock" };

export default async function StockPage({ searchParams }: { searchParams: Promise<{ low?: string }> }) {
  const sp = await searchParams;
  const variants = await db.productVariant.findMany({
    where: { product: { status: { not: "ARCHIVED" } }, ...(sp.low ? { stock: { lte: 5 } } : {}) },
    include: { product: { select: { id: true, name: true, isPlaceholder: true, category: { select: { name: true, sortOrder: true } } } }, _count: { select: { backInStockAlerts: { where: { notifiedAt: null } } } } },
    orderBy: [{ product: { isPlaceholder: "asc" } }, { product: { category: { sortOrder: "asc" } } }, { product: { name: "asc" } }, { sortOrder: "asc" }],
  });
  return (
    <div>
      <PageHeader title="Stock levels" description="Edit quantities and save. Customers waiting for restocks are emailed automatically." actions={<Link href={sp.low ? "/admin/stock" : "/admin/stock?low=1"} className="btn-outline btn-sm">{sp.low ? "Show all" : "Low stock only"}</Link>} />
      <form action={saveStock} className="card p-2">
        <Table head={["Product", "Variant", "SKU", "Category", "Waiting", "Stock"]}>
          {variants.map((v) => (
            <tr key={v.id} className={v.stock <= 0 ? "bg-red-50/50" : v.stock <= v.lowStockThreshold ? "bg-amber-50/50" : ""}>
              <td className="px-2 py-1.5"><Link href={`/admin/products/${v.product.id}`} className="hover:underline">{v.product.name}</Link> {v.product.isPlaceholder && <PlaceholderBadge />}</td>
              <td className="px-2">{v.name}</td>
              <td className="px-2 font-mono text-xs">{v.sku}</td>
              <td className="px-2 text-xs">{v.product.category.name}</td>
              <td className="px-2 text-xs">{v._count.backInStockAlerts || ""}</td>
              <td className="px-2">
                <input type="hidden" name={`orig[${v.id}]`} value={v.stock} />
                <input aria-label={`Stock for ${v.product.name} ${v.name}`} type="number" name={`stock[${v.id}]`} defaultValue={v.stock} className="input w-24 py-1" />
              </td>
            </tr>
          ))}
        </Table>
        <div className="sticky bottom-0 bg-white p-3"><button className="btn-primary">Save stock levels</button></div>
      </form>
    </div>
  );
}
