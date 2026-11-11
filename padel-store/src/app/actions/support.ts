"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { simpleEmail } from "@/lib/email/templates";
import { absoluteUrl, parseOrderNumber } from "@/lib/utils";

export type SupportState = { ok: boolean; message: string } | null;

async function notifyOwner(subject: string, lines: string[], href: string) {
  const to = process.env.OWNER_NOTIFICATION_EMAIL;
  if (!to) return;
  const { html } = simpleEmail(subject, lines, { href: absoluteUrl(href), label: "Open in admin" });
  await sendEmail({ to, subject, html, template: "owner-support" });
}

export async function submitContact(_prev: SupportState, formData: FormData): Promise<SupportState> {
  if (formData.get("website")) return { ok: true, message: "Thanks!" };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Please enter your name").max(100),
      email: z.string().trim().email("Please enter a valid email").max(200),
      subject: z.string().trim().min(2).max(120),
      orderNumber: z.string().trim().max(20).optional(),
      message: z.string().trim().min(10, "Please add a little more detail").max(5000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const d = parsed.data;
  await db.contactMessage.create({ data: { ...d, email: d.email.toLowerCase(), orderNumber: d.orderNumber || null } });
  const ack = simpleEmail("We've got your message", [`Hi ${d.name.split(" ")[0]}, thanks for getting in touch about "${d.subject}".`, "A member of the team will reply within one working day (usually much sooner)."]);
  await sendEmail({ to: d.email, subject: ack.subject, html: ack.html, template: "contact-ack" });
  await notifyOwner(`Contact form: ${d.subject}`, [`From ${d.name} <${d.email}>`, d.message], "/admin/messages");
  return { ok: true, message: "Thanks — we'll reply within one working day." };
}

export async function submitReturn(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const parsed = z
    .object({
      orderNumber: z.string().trim().min(3).max(20),
      email: z.string().trim().email().max(200),
      items: z.string().trim().min(2, "Tell us which items you're returning").max(2000),
      reason: z.enum(["changed-mind", "wrong-size", "faulty", "not-as-described", "arrived-damaged", "other"]),
      resolution: z.enum(["refund", "exchange"]),
      comments: z.string().trim().max(2000).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const n = parseOrderNumber(d.orderNumber);
  const order = n ? await db.order.findFirst({ where: { number: n, email: d.email.toLowerCase() } }) : null;
  if (!order) return { ok: false, message: "We couldn't find that order number for this email address." };
  const ageDays = (Date.now() - (order.deliveredAt ?? order.shippedAt ?? order.createdAt).getTime()) / 86400_000;
  const late = ageDays > 30 && !["faulty", "arrived-damaged", "not-as-described"].includes(d.reason);
  const rr = await db.returnRequest.create({ data: { ...d, email: d.email.toLowerCase(), comments: d.comments || null, status: late ? "REVIEW" : "REQUESTED" } });
  const ack = simpleEmail(`Return request received — ${d.orderNumber.toUpperCase()}`, [
    "Thanks — we've received your return request.",
    late
      ? "Your order is outside our 30-day returns window, so a member of the team will review it and reply within one working day."
      : "We'll email you a prepaid returns label within one working day. Please pack items securely in their original packaging.",
    `Return reference: ${rr.id.slice(-8).toUpperCase()}`,
  ]);
  await sendEmail({ to: d.email, subject: ack.subject, html: ack.html, template: "return-ack" });
  await notifyOwner(`Return request ${d.orderNumber}`, [`Reason: ${d.reason}, wants ${d.resolution}`, d.items], "/admin/messages");
  return { ok: true, message: `Return request received (ref ${rr.id.slice(-8).toUpperCase()}). Check your email for next steps.` };
}
