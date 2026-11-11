"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { addToCart } from "@/lib/cart";
import { getStripe } from "@/lib/stripe";
import { normalisePostcode, UK_POSTCODE } from "@/lib/utils";
import { signOut } from "@/auth";

export type AccountState = { ok: boolean; message: string } | null;

const addressSchema = z.object({
  label: z.string().trim().max(30).optional(),
  name: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(2).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  county: z.string().trim().max(80).optional(),
  postcode: z.string().trim().regex(UK_POSTCODE, "Enter a valid UK postcode"),
  phone: z.string().trim().max(30).optional(),
  isDefault: z.string().optional(),
});

export async function saveAddress(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/account/addresses");
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const { isDefault, ...data } = parsed.data;
  const id = formData.get("id")?.toString();
  const makeDefault = isDefault === "on" || (await db.address.count({ where: { userId: user.id } })) === 0;
  if (makeDefault) await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  const payload = { ...data, postcode: normalisePostcode(data.postcode), isDefault: makeDefault };
  if (id) {
    const owned = await db.address.findFirst({ where: { id, userId: user.id } });
    if (!owned) return { ok: false, message: "Address not found." };
    await db.address.update({ where: { id }, data: payload });
  } else {
    await db.address.create({ data: { ...payload, userId: user.id } });
  }
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddress(formData: FormData) {
  const user = await requireUser("/account/addresses");
  await db.address.deleteMany({ where: { id: String(formData.get("id")), userId: user.id } });
  revalidatePath("/account/addresses");
}

export async function reorder(formData: FormData) {
  const user = await requireUser("/account/orders");
  const order = await db.order.findFirst({ where: { id: String(formData.get("orderId")), userId: user.id }, include: { items: true } });
  if (!order) return;
  for (const item of order.items) {
    if (!item.variantId) continue;
    try {
      await addToCart(item.variantId, item.quantity);
    } catch {
      /* skip unavailable items */
    }
  }
  redirect("/checkout?reorder=1");
}

export async function removeCard(formData: FormData) {
  const user = await requireUser("/account/payment-methods");
  const s = getStripe();
  const pmId = String(formData.get("pm"));
  if (s && user.stripeCustomerId) {
    const pm = await s.paymentMethods.retrieve(pmId);
    if (pm.customer === user.stripeCustomerId) await s.paymentMethods.detach(pmId);
  }
  revalidatePath("/account/payment-methods");
}

export async function updateProfile(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/account/settings");
  const parsed = z
    .object({ name: z.string().trim().min(2).max(80), marketing: z.string().optional(), password: z.string().max(200).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const { name, marketing, password } = parsed.data;
  if (password && (password.length < 10 || !/\d/.test(password) || !/[A-Za-z]/.test(password))) {
    return { ok: false, message: "New password must be 10+ characters with a letter and a number." };
  }
  await db.user.update({
    where: { id: user.id },
    data: { name, marketingOptIn: marketing === "on", ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
  });
  if (marketing === "on") await db.newsletterSubscriber.upsert({ where: { email: user.email }, create: { email: user.email, source: "account" }, update: {} });
  else await db.newsletterSubscriber.deleteMany({ where: { email: user.email } });
  revalidatePath("/account/settings");
  return { ok: true, message: password ? "Profile and password updated." : "Profile updated." };
}

/** UK GDPR right to erasure: delete the account, keep anonymised order records for tax law (6 years). */
export async function deleteAccount(formData: FormData) {
  const user = await requireUser("/account/settings");
  if (formData.get("confirm") !== "DELETE") return;
  await db.order.updateMany({ where: { userId: user.id }, data: { userId: null } });
  await db.newsletterSubscriber.deleteMany({ where: { email: user.email } });
  await db.user.delete({ where: { id: user.id } });
  await signOut({ redirectTo: "/?account=deleted" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
