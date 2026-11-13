import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, PlaceholderBadge } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [product, categories, brands] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { variants: { orderBy: { sortOrder: "asc" } } } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();
  return (
    <div>
      <PageHeader
        title={product.name}
        description={sp.created ? "Product created ✓" : `${product.salesCount} sold · rating ${product.ratingAvg} (${product.ratingCount})`}
        actions={<>{product.isPlaceholder && <PlaceholderBadge />}<Link href={`/products/${product.slug}`} target="_blank" className="btn-outline btn-sm">View in shop</Link></>}
      />
      <ProductForm product={product} categories={categories} brands={brands} />
    </div>
  );
}
