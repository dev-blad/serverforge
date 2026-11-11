import { NextResponse } from "next/server";
import { loadCart, toCartDTO } from "@/lib/cart";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const shipping = new URL(req.url).searchParams.get("shipping");
  const cart = await loadCart();
  return NextResponse.json(await toCartDTO(cart, shipping), { headers: { "Cache-Control": "no-store" } });
}
