import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { getOrdersToPack } from "@/lib/pack-summary";
import { sendEmail } from "@/lib/email/send";
import { packSummaryEmail } from "@/lib/email/templates";
import { renderPackingSlips } from "@/lib/fulfilment/pdf";
import { toSlipOrder } from "@/lib/fulfilment";
import { printPdf } from "@/lib/fulfilment/printnode";

export const dynamic = "force-dynamic";

/** Morning "orders to pack" summary: emails the owner and (optionally) prints all packing slips. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orders = await getOrdersToPack();
  const to = process.env.OWNER_NOTIFICATION_EMAIL;
  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
  if (to && orders.length) {
    const rows = orders.map((o) => ({
      number: o.number,
      name: (o.shippingAddress as { name?: string }).name ?? o.email,
      items: o.items.map((i) => `${i.quantity}× ${i.name} (${i.variantName})`).join(", "),
      method: o.shippingMethod,
    }));
    const { subject, html } = packSummaryEmail(rows, dateLabel);
    await sendEmail({ to, subject, html, template: "daily-pack-summary" });
  }
  let printed = false;
  if (orders.length && process.env.PRINT_DAILY_SLIPS === "true") {
    const pdf = await renderPackingSlips(orders.map(toSlipOrder));
    printed = (await printPdf({ title: `Packing slips ${dateLabel}`, pdf, kind: "slip" })).ok;
  }
  return NextResponse.json({ orders: orders.length, emailed: Boolean(to && orders.length), printed });
}
