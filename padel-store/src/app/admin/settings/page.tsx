import { features } from "@/lib/config";
import { PageHeader, Panel } from "@/components/admin/ui";

export const metadata = { title: "Integrations" };

function Row({ name, ok, detail, env }: { name: string; ok: boolean; detail: string; env: string }) {
  return (
    <li className="flex flex-wrap items-start gap-3 border-b border-line py-3 last:border-0">
      <span className={`badge mt-0.5 ${ok ? "bg-brand-50 text-brand-800" : "bg-amber-100 text-amber-900"}`}>{ok ? "Connected" : "Stubbed"}</span>
      <div className="flex-1">
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-muted">{detail}</p>
        <p className="mt-1 font-mono text-xs text-muted">{env}</p>
      </div>
    </li>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Integrations" description="Everything works without credentials using safe local stubs. Add the environment variables in Vercel → Settings → Environment Variables, then redeploy. Full instructions in the README." />
      <Panel>
        <ul>
          <Row name="Stripe payments" ok={features.stripe} detail={features.stripe ? "Payment Element with Apple Pay, Google Pay, Link and saved cards." : "Simulated payments are active — no money is taken."} env="STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET" />
          <Row name="Transactional email (Resend)" ok={features.email} detail="Order confirmations, shipping, abandoned carts, magic links. Logged in Email outbox either way." env="RESEND_API_KEY, EMAIL_FROM" />
          <Row name="Google sign-in" ok={features.google} detail="Shows a 'Continue with Google' button on the sign-in page." env="AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET" />
          <Row name={`Shipping labels (${features.shippingProvider})`} ok={features.shippingProvider !== "stub"} detail={features.autoLabels ? "Labels are created automatically when an order is paid." : "Automatic labels are disabled (FULFILMENT_AUTO_LABELS=false)."} env="SHIPPING_PROVIDER=royalmail|shipstation, ROYALMAIL_API_KEY or SHIPSTATION_API_KEY/SECRET" />
          <Row name="PrintNode auto-printing" ok={features.printNode} detail={features.autoPrint ? "Labels + packing slips are sent to your printer automatically." : "Auto-print disabled (FULFILMENT_AUTO_PRINT=false)."} env="PRINTNODE_API_KEY, PRINTNODE_PRINTER_ID, PRINTNODE_SLIP_PRINTER_ID" />
          <Row name="WhatsApp chat routing (Twilio)" ok={features.whatsapp} detail="Website chat messages are forwarded to your WhatsApp; your replies come back to the visitor." env="TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, OWNER_WHATSAPP_TO" />
          <Row name={`Chat widget provider (${features.chatProvider})`} ok detail="internal = built-in widget (+ WhatsApp relay). crisp / tawk = third-party widget, loaded only after functional-cookie consent." env="NEXT_PUBLIC_CHAT_PROVIDER, NEXT_PUBLIC_CRISP_WEBSITE_ID, NEXT_PUBLIC_TAWK_PROPERTY_ID" />
          <Row name="Site analytics" ok={features.vercelAnalytics || Boolean(features.plausibleDomain)} detail={`${features.vercelAnalytics ? "Vercel Web Analytics" : ""}${features.plausibleDomain ? ` + Plausible (${features.plausibleDomain})` : ""} — consent-gated. First-party cookieless stats power this dashboard regardless.`} env="NEXT_PUBLIC_VERCEL_ANALYTICS, NEXT_PUBLIC_PLAUSIBLE_DOMAIN" />
          <Row name="Owner notifications" ok={Boolean(process.env.OWNER_NOTIFICATION_EMAIL)} detail="New-order alerts and the daily 'orders to pack' summary." env="OWNER_NOTIFICATION_EMAIL" />
        </ul>
      </Panel>
    </div>
  );
}
