import { NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/chat/twilio";
import { routeOwnerReply } from "@/lib/chat/service";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const twiml = (msg?: string) =>
  new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg.replace(/[<&]/g, "")}</Message>` : ""}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });

/** Twilio inbound WhatsApp webhook — the shop owner's replies are routed back to website chats. */
export async function POST(req: Request) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const owner = process.env.OWNER_WHATSAPP_TO?.replace(/^whatsapp:/, "");
  if (!token || !owner) return NextResponse.json({ error: "Not configured" }, { status: 404 });

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);
  // Twilio signs the exact public URL it called.
  const url = process.env.TWILIO_WEBHOOK_URL ?? absoluteUrl("/api/chat/whatsapp");
  if (!validateTwilioSignature(token, req.headers.get("x-twilio-signature") ?? "", url, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }
  if (params.From?.replace(/^whatsapp:/, "") !== owner) return twiml();

  const conv = await routeOwnerReply(params.Body ?? "", params.OriginalRepliedMessageSid);
  if (!conv) return twiml("⚠️ Couldn't match that to a website chat. Reply directly to a chat message, or start with #CODE.");
  return twiml();
}
