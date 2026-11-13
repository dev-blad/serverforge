import { db } from "@/lib/db";
import { deleteCategory, saveCategory } from "@/app/actions/admin-catalog";
import { PageHeader, PlaceholderBadge } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import type { Category } from "@prisma/client";

export const metadata = { title: "Categories" };

function Fields({ c }: { c?: Category }) {
  return (
    <div className="grid gap-3 md:grid-cols-6">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="md:col-span-2"><label className="label" htmlFor={`cn-${c?.id ?? "new"}`}>Name</label><input id={`cn-${c?.id ?? "new"}`} name="name" defaultValue={c?.name} required className="input" /></div>
      <div className="md:col-span-2"><label className="label" htmlFor={`cs-${c?.id ?? "new"}`}>Slug</label><input id={`cs-${c?.id ?? "new"}`} name="slug" defaultValue={c?.slug} className="input" /></div>
      <div><label className="label" htmlFor={`co-${c?.id ?? "new"}`}>Order</label><input id={`co-${c?.id ?? "new"}`} name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 99} className="input" /></div>
      <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" name="isPlaceholder" defaultChecked={c?.isPlaceholder} className="size-4 accent-brand-900" /> Placeholder</label>
      <div className="md:col-span-3"><label className="label" htmlFor={`cd-${c?.id ?? "new"}`}>Description</label><input id={`cd-${c?.id ?? "new"}`} name="description" defaultValue={c?.description} className="input" /></div>
      <div className="md:col-span-3"><label className="label" htmlFor={`ci-${c?.id ?? "new"}`}>Image URL</label><input id={`ci-${c?.id ?? "new"}`} name="image" defaultValue={c?.image ?? ""} className="input" /></div>
    </div>
  );
}

export default async function CategoriesPage() {
  const cats = await db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <div className="space-y-4">
      <PageHeader title="Categories" description="Placeholder categories show customers your future range; the flag is only visible here." />
      {cats.map((c) => (
        <details key={c.id} className="card p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">{c.name} <span className="text-xs font-normal text-muted">/c/{c.slug} · {c._count.products} products</span> {c.isPlaceholder && <PlaceholderBadge />}</summary>
          <ActionForm action={saveCategory} submitLabel="Save" buttonClass="btn-primary btn-sm mt-3" className="mt-4"><Fields c={c} /></ActionForm>
          {c._count.products === 0 && (
            <form action={deleteCategory} className="mt-2"><input type="hidden" name="id" value={c.id} /><button className="text-sm text-sale underline">Delete category</button></form>
          )}
        </details>
      ))}
      <section className="card p-4">
        <h2 className="mb-3 font-bold">Add category</h2>
        <ActionForm action={saveCategory} submitLabel="Create category" buttonClass="btn-primary btn-sm mt-3"><Fields /></ActionForm>
      </section>
    </div>
  );
}
