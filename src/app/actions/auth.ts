"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminEmails } from "@/lib/config";

export type RegisterState = { ok: boolean; message: string; email?: string; values?: { name: string; email: string } } | null;

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(200)
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/\d/, "Password must include a number"),
  marketing: z.string().optional(),
});

export async function registerUser(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message, values };
  const { name, email, password, marketing } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing?.passwordHash) return { ok: false, message: "An account with that email already exists — sign in instead.", values };
  const passwordHash = await bcrypt.hash(password, 12);
  const role = adminEmails().includes(email) ? "ADMIN" : "CUSTOMER";
  if (existing) {
    // Account created earlier via magic link / Google — add a password.
    await db.user.update({ where: { id: existing.id }, data: { passwordHash, name: existing.name ?? name } });
  } else {
    await db.user.create({ data: { name, email, passwordHash, role, marketingOptIn: marketing === "on" } });
  }
  // Link previous guest orders placed with this email.
  await db.order.updateMany({ where: { email, userId: null }, data: { userId: existing?.id ?? (await db.user.findUnique({ where: { email } }))!.id } });
  if (marketing === "on") await db.newsletterSubscriber.upsert({ where: { email }, create: { email, source: "register" }, update: {} });
  return { ok: true, message: "Account created", email };
}
