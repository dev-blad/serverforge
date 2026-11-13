"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type ActionState = { ok: boolean; message: string } | null;

export async function requestBackInStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ email: z.string().trim().email().max(200), variantId: z.string().min(1) })
    .safeParse({ email: formData.get("email"), variantId: formData.get("variantId") });
  if (!parsed.success) return { ok: false, message: "Please enter a valid email." };
  const variant = await db.productVariant.findUnique({ where: { id: parsed.data.variantId } });
  if (!variant) return { ok: false, message: "Product not found." };
  await db.backInStockAlert.upsert({
    where: { variantId_email: { variantId: variant.id, email: parsed.data.email.toLowerCase() } },
    create: { variantId: variant.id, email: parsed.data.email.toLowerCase() },
    update: { notifiedAt: null },
  });
  return { ok: true, message: "Done — we'll email you as soon as it's back." };
}

export async function submitReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Please sign in to leave a review." };
  const parsed = z
    .object({
      productId: z.string().min(1),
      rating: z.coerce.number().int().min(1).max(5),
      title: z.string().trim().min(3).max(80),
      body: z.string().trim().min(10).max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your review." };
  const { productId, rating, title, body } = parsed.data;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  const purchased = await db.orderItem.findFirst({
    where: { productId, order: { userId: session.user.id, status: { in: ["PAID", "PACKED", "SHIPPED", "DELIVERED"] } } },
  });
  await db.review.create({
    data: {
      productId,
      userId: session.user.id,
      authorName: user?.name ? `${user.name.split(" ")[0]} ${user.name.split(" ")[1]?.[0] ?? ""}.`.trim() : "Customer",
      rating,
      title,
      body,
      verified: Boolean(purchased),
      status: "PENDING",
    },
  });
  revalidatePath("/admin/reviews");
  return { ok: true, message: "Thanks! Your review will appear once it's been checked (usually within a day)." };
}
