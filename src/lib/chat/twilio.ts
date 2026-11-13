import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Twilio WhatsApp client (REST API, no SDK).
 * https://www.twilio.com/docs/whatsapp/api
 */
export async function sendWhatsApp(body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.OWNER_WHATSAPP_TO;
  if (!sid || !token || !from || !to) return { ok: false, error: "WhatsApp not configured" };
  const params = new URLSearchParams({ From: `whatsapp:${from.replace(/^whatsapp:/, "")}`, To: `whatsapp:${to.replace(/^whatsapp:/, "")}` });
  // Outside WhatsApp's 24-hour customer-service window a pre-approved template is required.
  if (process.env.TWILIO_WHATSAPP_TEMPLATE_SID) {
    params.set("ContentSid", process.env.TWILIO_WHATSAPP_TEMPLATE_SID);
    params.set("ContentVariables", JSON.stringify({ "1": body.slice(0, 1000) }));
  } else {
    params.set("Body", body.slice(0, 1500));
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `HTTP ${res.status}` };
    return { ok: true, sid: json.sid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Validate X-Twilio-Signature (HMAC-SHA1 of URL + sorted POST params, base64). */
export function validateTwilioSignature(authToken: string, signature: string, url: string, params: Record<string, string>): boolean {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
