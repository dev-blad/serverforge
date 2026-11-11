import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";

export const metadata = { title: "New product" };

export default async function NewProduct() {
  const [categories, brands] = await Promise.all([db.category.findMany({ orderBy: { sortOrder: "asc" } }), db.brand.findMany({ orderBy: { name: "asc" } })]);
  return (
    <div>
      <PageHeader title="Add product" />
      <ProductForm categories={categories} brands={brands} />
    </div>
  );
}
