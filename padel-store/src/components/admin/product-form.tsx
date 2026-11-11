"use client";

import { useActionState, useState } from "react";
import type { Brand, Category, Product, ProductVariant } from "@prisma/client";
import { saveProduct } from "@/app/actions/admin-catalog";
import type { AdminState } from "@/app/actions/admin-orders";

const pounds = (p: number | null | undefined) => (p == null ? "" : (p / 100).toFixed(2));

export function ProductForm({ product, categories, brands }: { product?: Product & { variants: ProductVariant[] }; categories: Category[]; brands: Brand[] }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveProduct, null);
  const [rows, setRows] = useState(product?.variants.length ? product.variants.length + 1 : 2);
  const specs = ((product?.specs as { label: string; value: string }[] | undefined) ?? []).map((s) => `${s.label}: ${s.value}`).join("\n");
  const text = (name: string, label: string, def?: string | number | null, opts: { required?: boolean; hint?: string; type?: string } = {}) => (
    <div>
      <label htmlFor={`pf-${name}`} className="label">{label}</label>
      <input id={`pf-${name}`} name={name} type={opts.type ?? "text"} required={opts.required} defaultValue={def ?? ""} className="input" aria-describedby={opts.hint ? `pf-${name}-hint` : undefined} />
      {opts.hint && <p id={`pf-${name}-hint`} className="mt-1 text-xs text-muted">{opts.hint}</p>}
    </div>
  );
  const select = (name: string, label: string, options: [string, string][], def?: string | null) => (
    <div>
      <label htmlFor={`pf-${name}`} className="label">{label}</label>
      <select id={`pf-${name}`} name={name} defaultValue={def ?? ""} className="input">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
  const check = (name: keyof Product, label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={Boolean(product?.[name])} className="size-4 accent-brand-900" /> {label}</label>
  );

  return (
    <form action={action} className="space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <h2 className="font-bold md:col-span-2">Details</h2>
        {text("name", "Name", product?.name, { required: true })}
        {text("slug", "URL slug", product?.slug, { hint: "Leave blank to generate from the name" })}
        {select("categoryId", "Category", categories.map((c) => [c.id, `${c.name}${c.isPlaceholder ? " (placeholder)" : ""}`]), product?.categoryId)}
        {select("brandId", "Brand", [["", "— none —"], ...brands.map((b) => [b.id, b.name] as [string, string])], product?.brandId)}
        {text("price", "Price (£, inc VAT)", pounds(product?.price), { required: true })}
        {text("compareAtPrice", "Was price (£) — shows as sale", pounds(product?.compareAtPrice))}
        <div className="md:col-span-2">{text("shortDescription", "Short description", product?.shortDescription)}</div>
        <div className="md:col-span-2">
          <label htmlFor="pf-description" className="label">Full description</label>
          <textarea id="pf-description" name="description" rows={6} defaultValue={product?.description} className="input" />
          <p className="mt-1 text-xs text-muted">Blank line between paragraphs.</p>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="pf-images" className="label">Image URLs (one per line, first is main)</label>
          <textarea id="pf-images" name="images" rows={3} defaultValue={product?.images.join("\n")} className="input font-mono text-xs" required />
          <p className="mt-1 text-xs text-muted">Use /images/… for files in public/, or any https URL from Vercel Blob storage.</p>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="pf-specs" className="label">Specifications (one “Label: Value” per line)</label>
          <textarea id="pf-specs" name="specs" rows={6} defaultValue={specs} className="input font-mono text-xs" />
        </div>
      </section>

      <section className="card grid gap-4 p-5 md:grid-cols-4">
        <h2 className="font-bold md:col-span-4">Filters & shipping</h2>
        {select("shape", "Shape", [["", "—"], ["Round", "Round"], ["Teardrop", "Teardrop"], ["Diamond", "Diamond"]], product?.shape)}
        {select("skillLevel", "Skill level", [["", "—"], ["Beginner", "Beginner"], ["Intermediate", "Intermediate"], ["Advanced", "Advanced"], ["Junior", "Junior"]], product?.skillLevel)}
        {select("balance", "Balance", [["", "—"], ["Low", "Low"], ["Medium", "Medium"], ["High", "High"]], product?.balance)}
        {text("weightGrams", "Racket weight (g)", product?.weightGrams, { type: "number" })}
        {text("shippingWeight", "Packed weight (g)", product?.shippingWeight ?? 500, { type: "number", required: true })}
        {select("status", "Status", [["ACTIVE", "Active (visible)"], ["DRAFT", "Draft (hidden)"], ["ARCHIVED", "Archived"]], product?.status ?? "ACTIVE")}
        <div className="flex flex-col gap-2 md:col-span-2">
          {check("isFeatured", "Featured on home page")}
          {check("isBestSeller", "Best seller badge")}
          {check("isNew", "New arrival badge")}
          {check("isPlaceholder", "Placeholder product (admin-only flag — swap for real stock)")}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">Variants & stock</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs text-muted uppercase"><th className="py-1">Option name</th><th>SKU</th><th>Price override (£)</th><th>Stock</th><th>Remove</th></tr></thead>
            <tbody>
              {Array.from({ length: rows }, (_, i) => {
                const v = product?.variants[i];
                return (
                  <tr key={v?.id ?? `new-${i}`}>
                    <td className="py-1 pr-2">{v && <input type="hidden" name={`v[${i}][id]`} value={v.id} />}<input aria-label={`Variant ${i + 1} name`} name={`v[${i}][name]`} defaultValue={v?.name ?? (i === 0 && !product ? "Standard" : "")} className="input py-1.5" /></td>
                    <td className="pr-2"><input aria-label={`Variant ${i + 1} SKU`} name={`v[${i}][sku]`} defaultValue={v?.sku} className="input py-1.5 uppercase" /></td>
                    <td className="pr-2"><input aria-label={`Variant ${i + 1} price`} name={`v[${i}][price]`} defaultValue={pounds(v?.price)} className="input py-1.5" placeholder="product price" /></td>
                    <td className="pr-2"><input aria-label={`Variant ${i + 1} stock`} name={`v[${i}][stock]`} type="number" defaultValue={v?.stock ?? 0} className="input w-24 py-1.5" /></td>
                    <td>{v && <input aria-label={`Remove variant ${v.name}`} type="checkbox" name={`v[${i}][remove]`} className="size-4 accent-sale" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setRows(rows + 1)} className="mt-2 text-sm font-semibold text-brand-700 underline">+ Add variant row</button>
      </section>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-canvas/95 py-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : product ? "Save changes" : "Create product"}</button>
        {state && <p role="status" className={`text-sm ${state.ok ? "text-brand-600" : "text-sale"}`}>{state.message}</p>}
      </div>
    </form>
  );
}
