import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CART_COOKIE } from "@/lib/cart";

/** Link from the abandoned-cart email: restore the cart cookie and open the basket. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const cart = token ? await db.cart.findUnique({ where: { token } }) : null;
  if (!cart) return NextResponse.redirect(new URL("/cart", url));
  if (cart.userId) return NextResponse.redirect(new URL("/account/login?callbackUrl=/cart", url));
  const res = NextResponse.redirect(new URL("/cart", url));
  res.cookies.set(CART_COOKIE, cart.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return res;
}
