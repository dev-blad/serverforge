import { db } from "@/lib/db";
import { randomCode } from "@/lib/utils";

export async function makeProduct(opts: { price?: number; stock?: number; category?: string } = {}) {
  const suffix = randomCode(6).toLowerCase();
  const category = await db.category.upsert({
    where: { slug: opts.category ?? "rackets" },
    create: { slug: opts.category ?? "rackets", name: "Rackets" },
    update: {},
  });
  return db.product.create({
    data: {
      slug: `test-racket-${suffix}`,
      name: `Test Racket ${suffix}`,
      price: opts.price ?? 12000,
      images: ["/images/products/kestrel-apex-carbon-1.svg"],
      categoryId: category.id,
      shippingWeight: 900,
      variants: { create: [{ sku: `TEST-${suffix.toUpperCase()}`, name: "Standard", stock: opts.stock ?? 10 }] },
    },
    include: { variants: true },
  });
}

export async function makeCart(items: { variantId: string; quantity: number }[], extra: { discountCode?: string; giftCardCode?: string } = {}) {
  return db.cart.create({ data: { token: randomCode(24), ...extra, items: { create: items } } });
}

export const address = { name: "Test Buyer", line1: "1 Test Street", city: "Manchester", postcode: "M4 6DE", country: "GB" };
