"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type CommunityState = { ok: boolean; message: string } | null;

export async function postListing(_prev: CommunityState, formData: FormData): Promise<CommunityState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Please sign in to post." };
  const parsed = z
    .object({
      title: z.string().trim().min(5, "Add a short title").max(80),
      city: z.string().trim().min(2).max(60),
      venueName: z.string().trim().max(100).optional(),
      level: z.string().trim().min(2).max(40),
      playDate: z.string().min(10),
      playersNeeded: z.coerce.number().int().min(1).max(3),
      description: z.string().trim().min(10, "Add a few details").max(1000),
      contact: z.string().trim().min(3, "How should players contact you?").max(150),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const playDate = new Date(parsed.data.playDate);
  if (Number.isNaN(playDate.getTime()) || playDate < new Date()) return { ok: false, message: "Choose a date and time in the future." };
  const open = await db.gameListing.count({ where: { userId: session.user.id, status: "OPEN", playDate: { gte: new Date() } } });
  if (open >= 5) return { ok: false, message: "You can have up to 5 open listings." };
  await db.gameListing.create({ data: { ...parsed.data, venueName: parsed.data.venueName || null, playDate, userId: session.user.id } });
  revalidatePath("/find-a-game");
  return { ok: true, message: "Posted! Your listing is now live." };
}

export async function closeListing(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.gameListing.updateMany({ where: { id: String(formData.get("id")), userId: session.user.id }, data: { status: "FILLED" } });
  revalidatePath("/find-a-game");
}
