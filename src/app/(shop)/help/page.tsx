import type { Metadata } from "next";
import Link from "next/link";
import { FAQS } from "@/lib/faqs";
import { Breadcrumbs } from "@/components/listing/breadcrumbs";

export const metadata: Metadata = { title: "Help centre & FAQs", description: "Delivery, returns, payment and racket-choosing FAQs from Courtline Padel." };

export default function HelpPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.flatMap((s) => s.items).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={[{ name: "Help centre" }]} />
      <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">How can we help?</h1>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Track my order", "/track", "Order number + email"],
          ["Start a return", "/returns", "30-day returns"],
          ["Contact us", "/contact", "Reply within 1 working day"],
          ["Racket finder", "/racket-finder", "Find the right racket"],
        ].map(([t, h, d]) => (
          <li key={h}><Link href={h!} className="card block p-5 hover:border-brand-500"><span className="font-bold">{t}</span><span className="block text-sm text-muted">{d}</span></Link></li>
        ))}
      </ul>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          {FAQS.map((s) => (
            <section key={s.section} aria-labelledby={`faq-${s.section}`} id={s.section === "Choosing kit" ? "racket-guide" : undefined} className="scroll-mt-28">
              <h2 id={`faq-${s.section}`} className="text-xl font-extrabold">{s.section}</h2>
              <div className="mt-3 divide-y divide-line rounded-xl border border-line">
                {s.items.map((f) => (
                  <details key={f.q} className="group p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                      {f.q}
                      <span className="text-xl text-muted transition group-open:rotate-45" aria-hidden>+</span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-ink/80">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="h-fit space-y-4 rounded-xl bg-brand-900 p-6 text-white">
          <h2 className="text-lg font-bold">Still need help?</h2>
          <p className="text-sm text-white/80">Use the chat button for a quick answer from a real player, or send us a message.</p>
          <Link href="/contact" className="btn-accent w-full">Contact us</Link>
        </aside>
      </div>
    </div>
  );
}
