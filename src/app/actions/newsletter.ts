"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { simpleEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/utils";

export type FormState = { ok: boolean; message: string } | null;

export async function subscribeNewsletter(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.string().trim().email().max(200).safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Please enter a valid email address." };
  if (formData.get("website")) return { ok: true, message: "Thanks!" }; // honeypot
  const email = parsed.data.toLowerCase();
  const existing = await db.newsletterSubscriber.findUnique({ where: { email } });
  if (!existing) {
    await db.newsletterSubscriber.create({ data: { email, source: String(formData.get("source") ?? "footer").slice(0, 30) } });
    const { subject, html } = simpleEmail(
      "Welcome to the Courtline club 🎾",
      [
        "Thanks for signing up. You'll be first to hear about new rackets, restocks and member-only offers.",
        "As a welcome, use code WELCOME10 for 10% off your first order.",
        "You can unsubscribe at any time using the link in any of our emails.",
      ],
      { href: absoluteUrl("/c/rackets"), label: "Shop rackets" },
    );
    await sendEmail({ to: email, subject, html, template: "newsletter-welcome" });
  }
  return { ok: true, message: "You're in! Check your inbox for 10% off." };
}
