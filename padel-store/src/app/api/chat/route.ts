import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { addVisitorMessage, CHAT_COOKIE, createConversation, findConversation } from "@/lib/chat/service";

export const dynamic = "force-dynamic";

const recent = new Map<string, number[]>();
function rateLimited(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > 20;
}

export async function GET(req: Request) {
  const jar = await cookies();
  const conv = await findConversation(jar.get(CHAT_COOKIE)?.value);
  if (!conv) return NextResponse.json({ conversation: null, messages: [] });
  const after = new URL(req.url).searchParams.get("after");
  const messages = await db.chatMessage.findMany({
    where: { conversationId: conv.id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, author: true, body: true, createdAt: true },
  });
  return NextResponse.json({ conversation: { name: conv.name, status: conv.status }, messages });
}

const schema = z.object({
  body: z.string().trim().min(1).max(2000),
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  pageUrl: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  const jar = await cookies();
  let conv = await findConversation(jar.get(CHAT_COOKIE)?.value);
  if (!conv) {
    conv = await createConversation({ name: parsed.data.name, email: parsed.data.email || undefined, pageUrl: parsed.data.pageUrl });
    jar.set(CHAT_COOKIE, conv.visitorToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  if (rateLimited(conv.id)) return NextResponse.json({ error: "You're sending messages too quickly." }, { status: 429 });
  const msg = await addVisitorMessage(conv.id, parsed.data.body);
  return NextResponse.json({ message: { id: msg.id, author: msg.author, body: msg.body, createdAt: msg.createdAt } });
}
