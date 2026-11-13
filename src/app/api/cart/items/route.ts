import { NextResponse } from "next/server";
import { z } from "zod";
import { addToCart, CartError, loadCart, toCartDTO, updateCartItem } from "@/lib/cart";
import { trackEvent } from "@/lib/analytics";

const addSchema = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20).default(1) });
const updateSchema = z.object({ itemId: z.string().min(1), quantity: z.number().int().min(0).max(20) });

async function respond(fn: () => Promise<void>) {
  try {
    await fn();
    return NextResponse.json(await toCartDTO(await loadCart()));
  } catch (e) {
    if (e instanceof CartError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    throw e;
  }
}

export async function POST(req: Request) {
  return respond(async () => {
    const body = addSchema.parse(await req.json());
    await addToCart(body.variantId, body.quantity);
    await trackEvent(req, { type: "add_to_cart" });
  });
}

export async function PATCH(req: Request) {
  return respond(async () => {
    const body = updateSchema.parse(await req.json());
    await updateCartItem(body.itemId, body.quantity);
  });
}
