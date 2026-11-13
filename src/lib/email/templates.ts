import { store } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { absoluteUrl, formatDate, formatOrderNumber } from "@/lib/utils";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, preheader = "") {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14211b">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f2;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0d3b2e;padding:20px 28px;color:#d9f99d;font-size:20px;font-weight:700;letter-spacing:-0.02em">${esc(store.name)}</td></tr>
<tr><td style="padding:28px">${body}</td></tr>
<tr><td style="padding:20px 28px;background:#f8faf7;color:#5b6b63;font-size:12px;line-height:1.6">
${esc(store.companyName)} · ${esc(store.address)}<br>Company no. ${esc(store.companyNumber)} · VAT ${esc(store.vatNumber)}<br>
<a href="${absoluteUrl("/help")}" style="color:#0d3b2e">Help centre</a> · <a href="${absoluteUrl("/policies/returns")}" style="color:#0d3b2e">Returns</a> · <a href="${absoluteUrl("/policies/privacy")}" style="color:#0d3b2e">Privacy</a>
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#0d3b2e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">${esc(label)}</a>`;

export interface EmailOrder {
  number: number;
  email: string;
  createdAt: Date;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  giftCardTotal: number;
  taxTotal: number;
  total: number;
  shippingMethod: string;
  shippingAddress: unknown;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrier?: string | null;
  items: { name: string; variantName: string; quantity: number; unitPrice: number }[];
}

function addressHtml(a: unknown) {
  const x = (a ?? {}) as Record<string, string | undefined>;
  return [x.name, x.line1, x.line2, x.city, x.county, x.postcode].filter(Boolean).map((s) => esc(String(s))).join("<br>");
}

function itemsTable(o: EmailOrder) {
  const rows = o.items
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0ec">${esc(i.name)}<br><span style="color:#5b6b63;font-size:13px">${esc(i.variantName)} × ${i.quantity}</span></td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #eef0ec">${formatPrice(i.unitPrice * i.quantity)}</td></tr>`,
    )
    .join("");
  const line = (label: string, v: string, bold = false) =>
    `<tr><td style="padding:4px 0;${bold ? "font-weight:700" : "color:#5b6b63"}">${label}</td><td align="right" style="padding:4px 0;${bold ? "font-weight:700" : ""}">${v}</td></tr>`;
  return `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${rows}
${line("Subtotal", formatPrice(o.subtotal))}
${o.discountTotal ? line("Discount", `−${formatPrice(o.discountTotal)}`) : ""}
${line(`Delivery (${esc(o.shippingMethod)})`, o.shippingTotal ? formatPrice(o.shippingTotal) : "Free")}
${o.giftCardTotal ? line("Gift card", `−${formatPrice(o.giftCardTotal)}`) : ""}
${line("Total paid", formatPrice(o.total), true)}
${line("Includes VAT (20%)", formatPrice(o.taxTotal))}
</table>`;
}

export function orderConfirmationEmail(o: EmailOrder) {
  const num = formatOrderNumber(o.number);
  const body = `<h1 style="font-size:22px;margin:0 0 8px">Thanks for your order!</h1>
<p style="margin:0 0 16px;color:#3b4a43">We've received order <strong>${num}</strong> placed on ${formatDate(o.createdAt)}. Orders placed before 2pm on a working day are dispatched the same day — we'll email you tracking as soon as it's on its way.</p>
${itemsTable(o)}
<h2 style="font-size:15px;margin:24px 0 6px">Delivering to</h2><p style="margin:0;color:#3b4a43;font-size:14px;line-height:1.5">${addressHtml(o.shippingAddress)}</p>
<p style="margin:24px 0">${button(absoluteUrl(`/track?order=${num}&email=${encodeURIComponent(o.email)}`), "View your order")}</p>
<p style="font-size:13px;color:#5b6b63">This email is your VAT receipt. You can return unused items within 30 days of delivery (your 14-day statutory right to cancel is unaffected) — see our returns policy.</p>`;
  return { subject: `Order confirmed — ${num}`, html: layout(`Order ${num}`, body, `Order ${num} confirmed`) };
}

export function shippingNotificationEmail(o: EmailOrder) {
  const num = formatOrderNumber(o.number);
  const track = o.trackingUrl
    ? `<p style="margin:20px 0">${button(o.trackingUrl, "Track your parcel")}</p>`
    : "";
  const body = `<h1 style="font-size:22px;margin:0 0 8px">Your order is on its way 🎾</h1>
<p style="margin:0 0 8px;color:#3b4a43">Order <strong>${num}</strong> has been dispatched with ${esc(o.carrier ?? o.shippingMethod)}.</p>
${o.trackingNumber ? `<p style="margin:0 0 8px;color:#3b4a43">Tracking number: <strong>${esc(o.trackingNumber)}</strong></p>` : ""}
${track}${itemsTable(o)}`;
  return { subject: `Your order ${num} has shipped`, html: layout(`Order ${num} shipped`, body, "Your padel kit is on the way") };
}

export function orderStatusEmail(o: EmailOrder, status: "DELIVERED" | "REFUNDED" | "CANCELLED") {
  const num = formatOrderNumber(o.number);
  const copy = {
    DELIVERED: ["Your order has been delivered", `Order <strong>${num}</strong> has been marked as delivered. Enjoy your new kit — and if you have a minute, we'd love a review.`],
    REFUNDED: ["Your refund is on its way", `We've refunded <strong>${formatPrice(o.total)}</strong> for order <strong>${num}</strong>. Refunds usually reach your account within 5–10 working days.`],
    CANCELLED: ["Your order has been cancelled", `Order <strong>${num}</strong> has been cancelled. If you were charged, a full refund has been issued.`],
  }[status];
  return { subject: `${copy[0]} — ${num}`, html: layout(copy[0], `<h1 style="font-size:22px;margin:0 0 8px">${copy[0]}</h1><p style="color:#3b4a43">${copy[1]}</p>`) };
}

export function abandonedCartEmail(items: { name: string; variantName: string; quantity: number; unitPrice: number }[], recoverUrl: string) {
  const rows = items
    .map((i) => `<li style="margin:4px 0">${esc(i.name)} <span style="color:#5b6b63">(${esc(i.variantName)}) × ${i.quantity}</span> — ${formatPrice(i.unitPrice * i.quantity)}</li>`)
    .join("");
  const body = `<h1 style="font-size:22px;margin:0 0 8px">Still thinking it over?</h1>
<p style="color:#3b4a43">You left some kit in your basket. We've saved it for you:</p><ul style="padding-left:18px;color:#14211b">${rows}</ul>
<p style="margin:20px 0">${button(recoverUrl, "Return to your basket")}</p>
<p style="font-size:13px;color:#5b6b63">Free UK delivery on orders over £50. Questions? Just reply to this email.</p>`;
  return { subject: "You left something in your basket", html: layout("Your basket", body, "Your basket is waiting") };
}

export function magicLinkEmail(url: string) {
  const body = `<h1 style="font-size:22px;margin:0 0 8px">Sign in to ${esc(store.name)}</h1>
<p style="color:#3b4a43">Click the button below to sign in. This link expires in 24 hours and can only be used once.</p>
<p style="margin:20px 0">${button(url, "Sign in")}</p>
<p style="font-size:13px;color:#5b6b63">If you didn't request this, you can safely ignore this email.</p>`;
  return { subject: `Your sign-in link for ${store.name}`, html: layout("Sign in", body, "Your sign-in link") };
}

export function simpleEmail(title: string, paragraphs: string[], cta?: { href: string; label: string }) {
  const body = `<h1 style="font-size:22px;margin:0 0 8px">${esc(title)}</h1>${paragraphs
    .map((p) => `<p style="color:#3b4a43;line-height:1.55">${esc(p)}</p>`)
    .join("")}${cta ? `<p style="margin:20px 0">${button(cta.href, cta.label)}</p>` : ""}`;
  return { subject: title, html: layout(title, body) };
}

export function packSummaryEmail(rows: { number: number; name: string; items: string; method: string }[], dateLabel: string) {
  const tr = rows
    .map((r) => `<tr><td style="padding:6px;border-bottom:1px solid #eee">${formatOrderNumber(r.number)}</td><td style="padding:6px;border-bottom:1px solid #eee">${esc(r.name)}</td><td style="padding:6px;border-bottom:1px solid #eee">${esc(r.items)}</td><td style="padding:6px;border-bottom:1px solid #eee">${esc(r.method)}</td></tr>`)
    .join("");
  const body = `<h1 style="font-size:20px;margin:0 0 8px">Orders to pack — ${esc(dateLabel)}</h1>
<p style="color:#3b4a43">${rows.length} order${rows.length === 1 ? "" : "s"} waiting to be packed.</p>
<table width="100%" style="border-collapse:collapse;font-size:13px"><tr style="text-align:left"><th style="padding:6px">Order</th><th style="padding:6px">Customer</th><th style="padding:6px">Items</th><th style="padding:6px">Service</th></tr>${tr}</table>
<p style="margin:20px 0">${button(absoluteUrl("/admin/fulfilment"), "Open fulfilment")}</p>`;
  return { subject: `📦 ${rows.length} order(s) to pack — ${dateLabel}`, html: layout("Orders to pack", body) };
}
