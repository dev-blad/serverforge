import "server-only";
import { db } from "@/lib/db";
import { features } from "@/lib/config";
import { sendEmail } from "@/lib/email/send";
import { simpleEmail } from "@/lib/email/templates";
import { absoluteUrl, randomCode } from "@/lib/utils";
import { sendWhatsApp } from "./twilio";

export const CHAT_COOKIE = "cl_chat";

export async function findConversation(visitorToken: string | undefined) {
  if (!visitorToken) return null;
  return db.chatConversation.findUnique({ where: { visitorToken } });
}

export async function createConversation(info: { name?: string; email?: string; pageUrl?: string }) {
  return db.chatConversation.create({
    data: { code: randomCode(4), visitorToken: randomCode(32), name: info.name || null, email: info.email || null, pageUrl: info.pageUrl },
  });
}

/** Store a visitor message and forward it to the owner's WhatsApp (fallback: email on first message). */
export async function addVisitorMessage(conversationId: string, body: string) {
  const conv = await db.chatConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), status: "OPEN" },
    include: { _count: { select: { messages: true } } },
  });
  const msg = await db.chatMessage.create({ data: { conversationId, author: "VISITOR", body } });
  const who = [conv.name, conv.email].filter(Boolean).join(" · ") || "Visitor";

  let relayed = false;
  if (features.whatsapp) {
    const text = `💬 #${conv.code} ${who}${conv._count.messages === 0 && conv.pageUrl ? ` (on ${conv.pageUrl})` : ""}:\n${body}\n\n↩️ Reply to this message to answer.`;
    const r = await sendWhatsApp(text);
    if (r.ok && r.sid) {
      await db.chatMessage.update({ where: { id: msg.id }, data: { externalId: r.sid } });
      relayed = true;
    } else console.error("[chat] WhatsApp relay failed:", r.error);
  }
  if (!relayed && conv._count.messages === 0 && process.env.OWNER_NOTIFICATION_EMAIL) {
    const { subject, html } = simpleEmail(`New website chat from ${who}`, [body], { href: absoluteUrl(`/admin/chat/${conv.id}`), label: "Reply in admin" });
    await sendEmail({ to: process.env.OWNER_NOTIFICATION_EMAIL, subject, html, template: "chat-notification" });
  }
  return msg;
}

export async function addAgentMessage(conversationId: string, body: string) {
  await db.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
  return db.chatMessage.create({ data: { conversationId, author: "AGENT", body } });
}

/**
 * Route an inbound WhatsApp reply from the owner to the right conversation:
 * 1) the WhatsApp message they replied to, 2) a "#CODE" prefix, 3) the most recent open chat (24h).
 */
export async function routeOwnerReply(text: string, repliedToSid?: string | null) {
  let conversationId: string | null = null;
  let body = text.trim();
  if (repliedToSid) {
    const m = await db.chatMessage.findFirst({ where: { externalId: repliedToSid } });
    conversationId = m?.conversationId ?? null;
  }
  const tag = body.match(/^#([A-Z0-9]{4})\b\s*/i);
  if (tag) {
    const c = await db.chatConversation.findUnique({ where: { code: tag[1]!.toUpperCase() } });
    if (c) {
      conversationId = c.id;
      body = body.slice(tag[0].length);
    }
  }
  if (!conversationId) {
    const recent = await db.chatConversation.findFirst({
      where: { status: "OPEN", lastMessageAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      orderBy: { lastMessageAt: "desc" },
    });
    conversationId = recent?.id ?? null;
  }
  if (!conversationId || !body) return null;
  const conv = await db.chatConversation.findUniqueOrThrow({ where: { id: conversationId } });
  await addAgentMessage(conversationId, body);
  return conv;
}
