import { NextResponse } from "next/server";
import { z } from "zod";
import { applyCode, CartError, loadCart, removeCode, toCartDTO } from "@/lib/cart";

export async function POST(req: Request) {
  try {
    const { code } = z.object({ code: z.string().max(40) }).parse(await req.json());
    const res = await applyCode(code);
    return NextResponse.json({ ...(await toCartDTO(await loadCart())), applied: res.kind });
  } catch (e) {
    if (e instanceof CartError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") === "giftcard" ? "giftcard" : "discount";
  await removeCode(kind);
  return NextResponse.json(await toCartDTO(await loadCart()));
}
