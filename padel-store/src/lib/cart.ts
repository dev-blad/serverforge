import "server-only";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { computeTotals, validateDiscount, validateGiftCard, type Totals } from "@/lib/pricing";
import { randomCode } from "@/lib/utils";

export const CART_COOKIE = "cl_cart";
const MAX_QTY = 20;

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          product: { select: { id: true, slug: true, name: true, images: true, price: true, status: true, category: { select: { slug: true } } } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export interface CartLine {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  stock: number;
  lineTotal: number;
  categorySlug: string;
}

export interface CartDTO {
  id: string | null;
  items: CartLine[];
  itemCount: number;
  discountCode: string | null;
  giftCardCode: string | null;
  giftCardBalance: number;
  totals: Totals;
  messages: string[];
}

async function setCartCookie(token: string) {
  const jar = await cookies();
  jar.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}

/** Load the current visitor's cart, merging a guest cart into the user's cart on login. */
export async function loadCart(opts: { create?: boolean } = {}): Promise<CartWithItems | null> {
  const [session, jar] = await Promise.all([auth(), cookies()]);
  const userId = session?.user?.id ?? null;
  const token = jar.get(CART_COOKIE)?.value ?? null;

  const guestCart = token ? await db.cart.findUnique({ where: { token }, include: cartInclude }) : null;

  if (userId) {
    let userCart = await db.cart.findUnique({ where: { userId }, include: cartInclude });
    if (guestCart && !guestCart.userId) {
      if (!userCart) {
        userCart = await db.cart.update({ where: { id: guestCart.id }, data: { userId }, include: cartInclude });
      } else if (guestCart.id !== userCart.id) {
        for (const item of guestCart.items) {
          await db.cartItem.upsert({
            where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
            create: { cartId: userCart.id, variantId: item.variantId, quantity: item.quantity },
            update: { quantity: { increment: item.quantity } },
          });
        }
        await db.cart.delete({ where: { id: guestCart.id } });
        userCart = await db.cart.findUnique({ where: { id: userCart.id }, include: cartInclude });
      }
    }
    if (!userCart && opts.create) {
      userCart = await db.cart.create({ data: { token: randomCode(24), userId }, include: cartInclude });
    }
    if (userCart && userCart.token !== token) await setCartCookie(userCart.token).catch(() => {});
    return userCart;
  }

  if (guestCart && !guestCart.userId) return guestCart;
  if (!opts.create) return null;
  const created = await db.cart.create({ data: { token: randomCode(24) }, include: cartInclude });
  await setCartCookie(created.token);
  return created;
}

export async function toCartDTO(cart: CartWithItems | null, shippingMethodId?: string | null): Promise<CartDTO> {
  const messages: string[] = [];
  const items: CartLine[] = (cart?.items ?? [])
    .filter((i) => i.variant.product.status === "ACTIVE")
    .map((i) => {
      const unitPrice = i.variant.price ?? i.variant.product.price;
      return {
        id: i.id,
        variantId: i.variantId,
        productId: i.variant.product.id,
        slug: i.variant.product.slug,
        name: i.variant.product.name,
        variantName: i.variant.name,
        image: i.variant.product.images[0] ?? null,
        unitPrice,
        quantity: i.quantity,
        stock: i.variant.stock,
        lineTotal: unitPrice * i.quantity,
        categorySlug: i.variant.product.category.slug,
      };
    });

  for (const l of items) {
    if (l.stock <= 0) messages.push(`${l.name} (${l.variantName}) is now out of stock.`);
    else if (l.quantity > l.stock) messages.push(`Only ${l.stock} of ${l.name} (${l.variantName}) left in stock.`);
  }

  const [discount, giftCard] = await Promise.all([
    cart?.discountCode ? db.discount.findUnique({ where: { code: cart.discountCode } }) : null,
    cart?.giftCardCode ? db.giftCard.findUnique({ where: { code: cart.giftCardCode } }) : null,
  ]);
  const totals = computeTotals({ lines: items, shippingMethodId, discount, giftCard });
  if (discount) {
    const v = validateDiscount(discount, totals.subtotal);
    if (!v.ok) messages.push(v.reason);
  }

  return {
    id: cart?.id ?? null,
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    discountCode: cart?.discountCode ?? null,
    giftCardCode: cart?.giftCardCode ?? null,
    giftCardBalance: giftCard?.balance ?? 0,
    totals,
    messages,
  };
}

export class CartError extends Error {}

export async function addToCart(variantId: string, quantity: number) {
  const variant = await db.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!variant || variant.product.status !== "ACTIVE") throw new CartError("That product is unavailable.");
  if (variant.stock <= 0) throw new CartError("Sorry, that item is out of stock.");
  const cart = (await loadCart({ create: true }))!;
  const existing = cart.items.find((i) => i.variantId === variantId);
  const next = Math.min(MAX_QTY, variant.stock, (existing?.quantity ?? 0) + Math.max(1, quantity));
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity: next },
    update: { quantity: next },
  });
  await db.cart.update({ where: { id: cart.id }, data: { abandonedEmailSentAt: null } });
}

export async function updateCartItem(itemId: string, quantity: number) {
  const cart = await loadCart();
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw new CartError("Item not found in your basket.");
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: itemId } });
    return;
  }
  const q = Math.min(MAX_QTY, Math.max(1, item.variant.stock), quantity);
  await db.cartItem.update({ where: { id: itemId }, data: { quantity: q } });
  await db.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
}

/** Apply a discount code or gift card code (auto-detected). */
export async function applyCode(rawCode: string): Promise<{ kind: "discount" | "giftcard" }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new CartError("Enter a code.");
  const cart = await loadCart({ create: true });
  const dto = await toCartDTO(cart);
  const discount = await db.discount.findUnique({ where: { code } });
  if (discount) {
    const v = validateDiscount(discount, dto.totals.subtotal);
    if (!v.ok) throw new CartError(v.reason);
    await db.cart.update({ where: { id: cart!.id }, data: { discountCode: code } });
    return { kind: "discount" };
  }
  const gc = await db.giftCard.findUnique({ where: { code } });
  if (gc) {
    const v = validateGiftCard(gc);
    if (!v.ok) throw new CartError(v.reason);
    await db.cart.update({ where: { id: cart!.id }, data: { giftCardCode: code } });
    return { kind: "giftcard" };
  }
  throw new CartError("That code isn't valid.");
}

export async function removeCode(kind: "discount" | "giftcard") {
  const cart = await loadCart();
  if (!cart) return;
  await db.cart.update({
    where: { id: cart.id },
    data: kind === "discount" ? { discountCode: null } : { giftCardCode: null },
  });
}
