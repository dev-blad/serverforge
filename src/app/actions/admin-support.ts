"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { addAgentMessage } from "@/lib/chat/service";

export async function replyToChat(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("conversationId"));
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (body) await addAgentMessage(id, body);
  revalidatePath(`/admin/chat/${id}`);
}

export async function setChatStatus(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("conversationId"));
  await db.chatConversation.update({ where: { id }, data: { status: String(formData.get("status")) === "CLOSED" ? "CLOSED" : "OPEN" } });
  revalidatePath("/admin/chat");
}

export async function markContactHandled(formData: FormData) {
  await assertAdmin();
  await db.contactMessage.update({ where: { id: String(formData.get("id")) }, data: { handled: true } });
  revalidatePath("/admin/messages");
}

export async function setReturnStatus(formData: FormData) {
  await assertAdmin();
  await db.returnRequest.update({ where: { id: String(formData.get("id")) }, data: { status: String(formData.get("status")) } });
  revalidatePath("/admin/messages");
}

export async function setListingStatus(formData: FormData) {
  await assertAdmin();
  await db.gameListing.update({ where: { id: String(formData.get("id")) }, data: { status: String(formData.get("status")) } });
  revalidatePath("/admin/community");
  revalidatePath("/find-a-game");
}
