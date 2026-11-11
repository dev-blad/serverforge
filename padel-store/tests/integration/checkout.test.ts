import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { CheckoutError, markOrderPaid, updateOrderStatus, upsertPendingOrder, afterOrderPaid } from "@/lib/orders";
import { address, makeCart, makeProduct } from "../support/factory";

afterAll(() => db.$disconnect());

describe("checkout → order", () => {
  it("creates a pending order with server-side totals and reuses it on re-submit", async () => {
    const p = await makeProduct({ price: 12000 });
    await db.discount.create({ data: { code: "TEST10", type: "PERCENT", value: 10 } });
    const cart = await makeCart([{ variantId: p.variants[0]!.id, quantity: 2 }], { discountCode: "TEST10" });
    const o1 = await upsertPendingOrder({ cartId: cart.id, userId: null, email: "A@Example.com", address, shippingMethodId: "rm-tracked24", savePaymentMethod: false });
    expect(o1.status).toBe("PENDING_PAYMENT");
    expect(o1.email).toBe("a@example.com");
    expect(o1.subtotal).toBe(24000);
    expect(o1.discountTotal).toBe(2400);
    expect(o1.shippingTotal).toBe(599);
    expect(o1.total).toBe(24000 - 2400 + 599);

    const o2 = await upsertPendingOrder({ cartId: cart.id, userId: null, email: "a@example.com", address, shippingMethodId: "rm-tracked48", savePaymentMethod: false });
    expect(o2.id).toBe(o1.id);
    expect(o2.shippingTotal).toBe(0);
    expect(await db.orderItem.count({ where: { orderId: o1.id } })).toBe(1);
  });

  it("rejects baskets with more than available stock", async () => {
    const p = await makeProduct({ stock: 1 });
    const cart = await makeCart([{ variantId: p.variants[0]!.id, quantity: 2 }]);
    await expect(upsertPendingOrder({ cartId: cart.id, userId: null, email: "x@example.com", address, shippingMethodId: "rm-tracked48", savePaymentMethod: false })).rejects.toBeInstanceOf(CheckoutError);
  });

  it("marks paid once: decrements stock, redeems gift card, clears cart; refund restocks + restores gift card", async () => {
    const p = await makeProduct({ price: 6000, stock: 5 });
    await db.giftCard.create({ data: { code: "GIFT-T1", initialBalance: 2000, balance: 2000 } });
    const cart = await makeCart([{ variantId: p.variants[0]!.id, quantity: 1 }], { giftCardCode: "GIFT-T1" });
    const order = await upsertPendingOrder({ cartId: cart.id, userId: null, email: "gc@example.com", address, shippingMethodId: "rm-tracked48", savePaymentMethod: false });
    expect(order.giftCardTotal).toBe(2000);
    expect(order.total).toBe(4000);

    expect(await markOrderPaid(order.id, { provider: "simulated" })).toBe(true);
    expect(await markOrderPaid(order.id, { provider: "simulated" })).toBe(false); // idempotent
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: p.variants[0]!.id } })).stock).toBe(4);
    expect((await db.giftCard.findUniqueOrThrow({ where: { code: "GIFT-T1" } })).balance).toBe(0);
    expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(0);

    await afterOrderPaid(order.id);
    const shipment = await db.shipment.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(shipment.status).toBe("LABEL_CREATED");
    expect(Buffer.from(shipment.labelPdf!).subarray(0, 4).toString()).toBe("%PDF");

    await updateOrderStatus(order.id, "REFUNDED");
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: p.variants[0]!.id } })).stock).toBe(5);
    expect((await db.giftCard.findUniqueOrThrow({ where: { code: "GIFT-T1" } })).balance).toBe(2000);
    await expect(updateOrderStatus(order.id, "SHIPPED")).rejects.toThrow(/Cannot move/);
  });

  it("status workflow sends a shipping email with tracking", async () => {
    const p = await makeProduct();
    const cart = await makeCart([{ variantId: p.variants[0]!.id, quantity: 1 }]);
    const order = await upsertPendingOrder({ cartId: cart.id, userId: null, email: "ship@example.com", address, shippingMethodId: "rm-tracked48", savePaymentMethod: false });
    await markOrderPaid(order.id, { provider: "simulated" });
    await updateOrderStatus(order.id, "PACKED");
    await updateOrderStatus(order.id, "SHIPPED", { trackingNumber: "RM123456789GB" });
    const mail = await db.emailLog.findFirst({ where: { to: "ship@example.com", template: "shipping-notification" } });
    expect(mail?.html).toContain("RM123456789GB");
  });
});
