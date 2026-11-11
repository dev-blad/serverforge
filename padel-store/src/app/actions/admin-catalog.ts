"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { assertAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { poundsToPence } from "@/lib/money";
import { slugify } from "@/lib/utils";
import { setVariantStock } from "@/lib/stock";
import type { AdminState } from "./admin-orders";

function refreshCatalog(slug?: string) {
  revalidateTag("catalog");
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/products/${slug}`);
}

const money = z.string().trim().transform((v, ctx) => {
  if (!v) return null;
  const p = poundsToPence(v);
  if (Number.isNaN(p) || p < 0) {
    ctx.addIssue({ code: "custom", message: `Invalid price "${v}"` });
    return z.NEVER;
  }
  return p;
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().max(140).optional(),
  categoryId: z.string().min(1),
  brandId: z.string().optional(),
  price: money.refine((v) => v !== null, "Price is required"),
  compareAtPrice: money,
  shortDescription: z.string().trim().max(300),
  description: z.string().trim().max(10000),
  images: z.string().max(5000),
  specs: z.string().max(5000),
  weightGrams: z.string().optional(),
  shape: z.string().optional(),
  skillLevel: z.string().optional(),
  balance: z.string().optional(),
  shippingWeight: z.coerce.number().int().min(1).max(30000),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
});

export async function saveProduct(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await assertAdmin();
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = parsed.data;
  const id = formData.get("id")?.toString();
  const flags = (k: string) => formData.get(k) === "on";

  const data = {
    name: d.name,
    slug: slugify(d.slug || d.name),
    categoryId: d.categoryId,
    brandId: d.brandId || null,
    price: d.price!,
    compareAtPrice: d.compareAtPrice,
    shortDescription: d.shortDescription,
    description: d.description,
    images: d.images.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    specs: d.specs
      .split(/\r?\n/)
      .map((l) => l.split(":"))
      .filter((p) => p.length >= 2 && p[0]!.trim())
      .map(([label, ...rest]) => ({ label: label!.trim(), value: rest.join(":").trim() })) as Prisma.InputJsonValue,
    weightGrams: d.weightGrams ? Number(d.weightGrams) || null : null,
    shape: d.shape || null,
    skillLevel: d.skillLevel || null,
    balance: d.balance || null,
    shippingWeight: d.shippingWeight,
    status: d.status,
    isFeatured: flags("isFeatured"),
    isBestSeller: flags("isBestSeller"),
    isNew: flags("isNew"),
    isPlaceholder: flags("isPlaceholder"),
  };
  if (!data.images.length) return { ok: false, message: "Add at least one image URL." };

  // Variants: rows v[i][field]
  const rows: { id?: string; name: string; sku: string; price: number | null; stock: number; remove: boolean }[] = [];
  for (let i = 0; i < 50; i++) {
    const name = formData.get(`v[${i}][name]`)?.toString().trim();
    const sku = formData.get(`v[${i}][sku]`)?.toString().trim().toUpperCase();
    if (!name && !sku) continue;
    if (!name || !sku) return { ok: false, message: `Variant row ${i + 1} needs a name and SKU` };
    const priceRaw = formData.get(`v[${i}][price]`)?.toString().trim();
    const price = priceRaw ? poundsToPence(priceRaw) : null;
    if (price !== null && Number.isNaN(price)) return { ok: false, message: `Variant ${name}: invalid price` };
    rows.push({
      id: formData.get(`v[${i}][id]`)?.toString() || undefined,
      name,
      sku,
      price,
      stock: Math.max(-999, Number.parseInt(formData.get(`v[${i}][stock]`)?.toString() ?? "0", 10) || 0),
      remove: formData.get(`v[${i}][remove]`) === "on",
    });
  }
  if (!rows.some((r) => !r.remove)) return { ok: false, message: "A product needs at least one variant." };

  try {
    let productId = id;
    if (id) await db.product.update({ where: { id }, data });
    else productId = (await db.product.create({ data })).id;

    const stockUpdates: { id: string; stock: number }[] = [];
    for (const [i, r] of rows.entries()) {
      if (r.id && r.remove) {
        const used = await db.orderItem.count({ where: { variantId: r.id } });
        if (used) await db.productVariant.update({ where: { id: r.id }, data: { stock: 0, sortOrder: 999 } });
        else await db.productVariant.delete({ where: { id: r.id } });
      } else if (r.id) {
        await db.productVariant.update({ where: { id: r.id }, data: { name: r.name, sku: r.sku, price: r.price, sortOrder: i } });
        stockUpdates.push({ id: r.id, stock: r.stock });
      } else if (!r.remove) {
        await db.productVariant.create({ data: { productId: productId!, name: r.name, sku: r.sku, price: r.price, stock: r.stock, sortOrder: i } });
      }
    }
    const notified = await setVariantStock(stockUpdates);
    refreshCatalog(data.slug);
    if (!id) redirect(`/admin/products/${productId}?created=1`);
    return { ok: true, message: `Saved.${notified ? ` ${notified} back-in-stock email(s) sent.` : ""}` };
  } catch (e) {
    if (e instanceof Error && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg.includes("Unique constraint") ? "Slug or SKU already in use." : msg };
  }
}

export async function saveStock(formData: FormData) {
  await assertAdmin();
  const updates: { id: string; stock: number }[] = [];
  for (const [k, v] of formData.entries()) {
    const m = k.match(/^stock\[(.+)\]$/);
    if (m && v !== "" && formData.get(`orig[${m[1]}]`) !== v) updates.push({ id: m[1]!, stock: Number.parseInt(String(v), 10) || 0 });
  }
  await setVariantStock(updates);
  refreshCatalog();
  revalidatePath("/admin/stock");
}

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500),
  image: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int(),
});

export async function saveCategory(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await assertAdmin();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const id = formData.get("id")?.toString();
  const data = { ...parsed.data, slug: slugify(parsed.data.slug || parsed.data.name), image: parsed.data.image || null, isPlaceholder: formData.get("isPlaceholder") === "on" };
  try {
    if (id) await db.category.update({ where: { id }, data });
    else await db.category.create({ data });
  } catch {
    return { ok: false, message: "That slug is already in use." };
  }
  refreshCatalog();
  revalidatePath("/admin/categories");
  return { ok: true, message: "Category saved." };
}

export async function deleteCategory(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  if (await db.product.count({ where: { categoryId: id } })) return;
  await db.category.delete({ where: { id } });
  refreshCatalog();
  revalidatePath("/admin/categories");
}
