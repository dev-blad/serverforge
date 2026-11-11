import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const schema = z.object({ merge: z.array(z.string().max(40)).max(100).optional(), toggle: z.string().max(40).optional() });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ids: [] });
  const items = await db.wishlistItem.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ids: items.map((i) => i.productId) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const userId = session.user.id;
  const body = schema.parse(await req.json());
  if (body.merge?.length) {
    const valid = await db.product.findMany({ where: { id: { in: body.merge } }, select: { id: true } });
    await db.wishlistItem.createMany({ data: valid.map((p) => ({ userId, productId: p.id })), skipDuplicates: true });
  }
  if (body.toggle) {
    const existing = await db.wishlistItem.findUnique({ where: { userId_productId: { userId, productId: body.toggle } } });
    if (existing) await db.wishlistItem.delete({ where: { userId_productId: { userId, productId: body.toggle } } });
    else if (await db.product.findUnique({ where: { id: body.toggle } })) await db.wishlistItem.create({ data: { userId, productId: body.toggle } });
  }
  const items = await db.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ids: items.map((i) => i.productId) });
}
