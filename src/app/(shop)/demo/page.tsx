import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { features } from "@/lib/config";

export const metadata: Metadata = { title: "Demo test guide", robots: { index: false } };

const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-sm ring-1 ring-line">{children}</code>;

export default function DemoGuide() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") notFound();
  const steps: { title: string; items: React.ReactNode[] }[] = [
    {
      title: "1. Shop as a guest",
      items: [
        <>Browse <Link className="underline" href="/c/rackets">rackets</Link>, try the filters (shape, level, weight…) and sorting.</>,
        <>Open a <Link className="underline" href="/products/kestrel-apex-carbon">product</Link>: hover the image to zoom, switch colour, read reviews, add the “frequently bought together” bundle.</>,
        <>Search from the header (try “diamond” or “balls”) and use the <Link className="underline" href="/racket-finder">racket finder</Link>.</>,
        <>Watch the free-delivery bar fill up in the basket. Apply code <Code>WELCOME10</Code>, <Code>FREESHIP</Code> or <Code>SAVE15</Code> (over £100). <Code>SUMMER25</Code> is expired on purpose.</>,
        <>Gift cards: <Code>GIFT-DEMO-25</Code> (£25) or <Code>GIFT-DEMO-500</Code> (covers a whole order — no card needed).</>,
        features.stripe ? (
          <>Check out with Stripe test card <Code>4242 4242 4242 4242</Code>, any future expiry, any CVC. Use <Code>4000 0027 6000 3184</Code> to test 3-D Secure.</>
        ) : (
          <>At payment you&apos;ll see <strong>demo payment mode</strong> (Stripe isn&apos;t connected yet) — click Pay, or “simulate a declined card”.</>
        ),
        <>On the confirmation page note your order number, then try <Link className="underline" href="/track">Track my order</Link> with it and your email.</>,
      ],
    },
    {
      title: "2. Try a customer account",
      items: [
        <>Sign in as <Code>demo@courtline.test</Code> / <Code>PadelDemo!2026</Code> (has saved addresses and past orders) — or create your own account.</>,
        <>See <Link className="underline" href="/account/orders">order history</Link>, open an order, download the VAT invoice, and press <strong>Buy again</strong> for a fast repeat checkout with your saved address.</>,
        <>Heart a few products then view your <Link className="underline" href="/wishlist">wishlist</Link>; check <Link className="underline" href="/account/settings">settings & privacy</Link> (data export / delete).</>,
      ],
    },
    {
      title: "3. Run the shop (admin)",
      items: [
        <>Sign in as <Code>admin@courtline.test</Code> / <Code>CourtlineAdmin!2026</Code>, then open <Link className="underline" href="/admin">/admin</Link>.</>,
        <>Dashboard: switch 7/30/90 days and day/week/month; toggle “Real orders only” to see just your test orders.</>,
        <>Orders → open your test order: the shipping label was created automatically — download it, print the packing slip, then mark it <strong>packed → shipped → delivered</strong> (or refund it).</>,
        <>Email outbox: every email the shop sent (confirmation, shipping, abandoned basket…) with a preview.</>,
        <>Fulfilment: today&apos;s pick list, all packing slips as one PDF, printable daily summary.</>,
        <>Products: placeholder items are flagged; edit one, change stock in Stock (back-in-stock emails fire automatically), create a discount code.</>,
        <>Integrations: shows which services are connected vs. running as safe stubs.</>,
      ],
    },
    {
      title: "4. Support & community",
      items: [
        <>Open the chat bubble (bottom-right) and send a message, then reply from <Link className="underline" href="/admin/chat">Admin → Live chat</Link> — the reply appears in the shopper&apos;s chat within a few seconds. With Twilio set up, chats go to WhatsApp instead.</>,
        <>Submit the <Link className="underline" href="/contact">contact form</Link> and a <Link className="underline" href="/returns">return request</Link> (needs a real order number + email); see them in Admin → Contact & returns.</>,
        <><Link className="underline" href="/find-a-game">Find a game</Link>: search courts, show the map, and (signed in) post a “looking for players” listing.</>,
        <>Use “Cookie settings” in the footer to change consent; legal pages are under <Link className="underline" href="/policies/privacy">Policies</Link>.</>,
      ],
    },
  ];
  return (
    <div className="container-page max-w-3xl py-10">
      <p className="text-xs font-bold tracking-widest text-brand-600 uppercase">Demo store</p>
      <h1 className="mt-1 text-3xl font-extrabold">How to test everything</h1>
      <p className="mt-2 text-muted">This is a test build — no real payments are taken and nothing is shipped. Data resets only if the database is re-seeded.</p>
      <div className="mt-8 space-y-6">
        {steps.map((s) => (
          <section key={s.title} className="card p-6">
            <h2 className="text-lg font-bold">{s.title}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              {s.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
