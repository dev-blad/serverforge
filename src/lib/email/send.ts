import { Resend } from "resend";
import { db } from "@/lib/db";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  template: string;
  replyTo?: string;
}

let client: Resend | null = null;
function resend() {
  if (!process.env.RESEND_API_KEY) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

/**
 * Send a transactional email. Every email is recorded in the EmailLog table
 * (visible at /admin/emails) — when RESEND_API_KEY is not configured the email
 * is logged as "STUBBED" instead of being delivered, so flows remain testable.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string }> {
  const from = process.env.EMAIL_FROM ?? "Courtline Padel <orders@courtline.example>";
  const r = resend();
  let status = "STUBBED";
  let providerId: string | undefined;
  let error: string | undefined;

  if (r) {
    try {
      const res = await r.emails.send({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        replyTo: msg.replyTo ?? process.env.EMAIL_REPLY_TO,
      });
      if (res.error) {
        status = "FAILED";
        error = res.error.message;
      } else {
        status = "SENT";
        providerId = res.data?.id;
      }
    } catch (e) {
      status = "FAILED";
      error = e instanceof Error ? e.message : String(e);
    }
  } else if (process.env.NODE_ENV !== "test") {
    console.info(`[email:stub] → ${msg.to} | ${msg.subject}`);
  }

  try {
    await db.emailLog.create({
      data: { to: msg.to, subject: msg.subject, html: msg.html, template: msg.template, status, providerId, error },
    });
  } catch (e) {
    console.error("[email] failed to write EmailLog", e);
  }
  if (error) console.error(`[email] ${msg.template} to ${msg.to} failed: ${error}`);
  return { ok: status !== "FAILED", id: providerId };
}
