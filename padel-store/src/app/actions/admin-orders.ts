"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { assertAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { afterOrderPaid, logOrderEvent, updateOrderStatus } from "@/lib/orders";
import { createShipmentForOrder, printShipmentDocs } from "@/lib/fulfilment";
import { sendEmail } from "@/lib/email/send";
import { orderConfirmationEmail, type EmailOrder } from "@/lib/email/templates";

export type AdminState = { ok: boolean; message: string } | null;

function done(orderId: string, message: string): AdminState {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/fulfilment");
  return { ok: true, message };
}

const fail = (e: unknown): AdminState => ({ ok: false, message: e instanceof Error ? e.message : String(e) });

export async function changeOrderStatus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();
  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status")) as OrderStatus;
  try {
    await updateOrderStatus(orderId, status, {
      trackingNumber: formData.get("trackingNumber")?.toString().trim() || undefined,
      restock: formData.get("restock") !== "off",
      actor: admin.email,
    });
    return done(orderId, `Order marked ${status.toLowerCase()}`);
  } catch (e) {
    return fail(e);
  }
}

export async function createLabelAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  try {
    await createShipmentForOrder(orderId, { force: formData.get("force") === "1", print: formData.get("print") === "1" });
    return done(orderId, "Label created");
  } catch (e) {
    return fail(e);
  }
}

export async function printDocsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  try {
    const s = await printShipmentDocs(orderId);
    return done(orderId, s.printJobId ? `Sent to printer (job ${s.printJobId})` : "PrintNode not configured — download the PDFs instead");
  } catch (e) {
    return fail(e);
  }
}

export async function resendConfirmation(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const { subject, html } = orderConfirmationEmail(order as EmailOrder);
  await sendEmail({ to: order.email, subject, html, template: "order-confirmation" });
  await logOrderEvent(orderId, "email", "Order confirmation re-sent by admin");
  return done(orderId, "Confirmation email re-sent");
}

export async function addOrderNote(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await assertAdmin();
  const orderId = String(formData.get("orderId"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (!note) return { ok: false, message: "Note is empty" };
  await logOrderEvent(orderId, "note", `${admin.email}: ${note}`);
  return done(orderId, "Note added");
}

/** Re-run the post-payment pipeline (email + label) — useful after configuring an integration. */
export async function rerunFulfilment(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  await afterOrderPaid(orderId);
  return done(orderId, "Post-payment pipeline re-run");
}

export async function bulkStatus(formData: FormData) {
  const admin = await assertAdmin();
  const ids = formData.getAll("ids").map(String);
  const status = String(formData.get("status")) as OrderStatus;
  for (const id of ids) {
    try {
      await updateOrderStatus(id, status, { actor: admin.email });
    } catch {
      /* skip orders that can't transition */
    }
  }
  revalidatePath("/admin/fulfilment");
  revalidatePath("/admin/orders");
}
