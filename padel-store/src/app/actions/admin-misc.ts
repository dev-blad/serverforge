"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { poundsToPence } from "@/lib/money";
import { randomCode } from "@/lib/utils";
import type { AdminState } from "./admin-orders";

export async function saveDiscount(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await assertAdmin();
  const parsed = z
    .object({
      code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Code: letters, numbers, - and _ only"),
      description: z.string().trim().max(200),
      type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
      value: z.string().trim(),
      minSubtotal: z.string().trim(),
      usageLimit: z.string().trim(),
      endsAt: z.string().trim(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const value = d.type === "PERCENT" ? Number.parseInt(d.value, 10) : d.type === "FIXED" ? poundsToPence(d.value) : 0;
  if (d.type !== "FREE_SHIPPING" && (!Number.isFinite(value) || value <= 0 || (d.type === "PERCENT" && value > 100))) {
    return { ok: false, message: "Enter a valid value (1–100 for %, or a £ amount)." };
  }
  try {
    await db.discount.create({
      data: {
        code: d.code.toUpperCase(),
        description: d.description,
        type: d.type,
        value,
        minSubtotal: d.minSubtotal ? poundsToPence(d.minSubtotal) || 0 : 0,
        usageLimit: d.usageLimit ? Number.parseInt(d.usageLimit, 10) : null,
        endsAt: d.endsAt ? new Date(`${d.endsAt}T23:59:59`) : null,
      },
    });
  } catch {
    return { ok: false, message: "That code already exists." };
  }
  revalidatePath("/admin/discounts");
  return { ok: true, message: `Discount ${d.code.toUpperCase()} created.` };
}

export async function toggleDiscount(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const d = await db.discount.findUniqueOrThrow({ where: { id } });
  await db.discount.update({ where: { id }, data: { active: !d.active } });
  revalidatePath("/admin/discounts");
}

export async function createGiftCard(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await assertAdmin();
  const amount = poundsToPence(String(formData.get("amount") ?? ""));
  if (!Number.isFinite(amount) || amount < 100 || amount > 100000) return { ok: false, message: "Amount must be £1–£1,000." };
  const code = `GIFT-${randomCode(4)}-${randomCode(4)}`;
  const months = 24;
  await db.giftCard.create({
    data: { code, initialBalance: amount, balance: amount, note: String(formData.get("note") ?? "").slice(0, 200) || null, expiresAt: new Date(Date.now() + months * 30 * 86400_000) },
  });
  revalidatePath("/admin/discounts");
  return { ok: true, message: `Gift card ${code} created.` };
}

export async function moderateReview(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const status = formData.get("status") === "APPROVED" ? "APPROVED" : "REJECTED";
  const review = await db.review.update({ where: { id }, data: { status } });
  const agg = await db.review.aggregate({ where: { productId: review.productId, status: "APPROVED" }, _avg: { rating: true }, _count: true });
  const product = await db.product.update({
    where: { id: review.productId },
    data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
  });
  revalidateTag("catalog");
  revalidatePath(`/products/${product.slug}`);
  revalidatePath("/admin/reviews");
}
