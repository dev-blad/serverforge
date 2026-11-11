import type { Metadata } from "next";
import { store } from "@/lib/config";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact us", description: "Get in touch with the Courtline Padel team." };

export default function ContactPage() {
  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-3xl font-extrabold">Contact us</h1>
        <p className="mt-2 text-muted">Questions about kit, an order or a club order? We reply within one working day.</p>
        <ContactForm />
      </div>
      <aside className="card h-fit space-y-3 p-6 text-sm">
        <h2 className="font-bold">Other ways to reach us</h2>
        <p><strong>Live chat:</strong> bottom-right of every page, 9am–7pm.</p>
        <p><strong>Email:</strong> <a className="text-brand-700 underline" href={`mailto:${store.email}`}>{store.email}</a></p>
        {store.phone && <p><strong>Phone:</strong> {store.phone}</p>}
        <p><strong>Address:</strong> {store.companyName}, {store.address}</p>
        <p className="text-xs text-muted">This is our registered office, not a shop — we&apos;re online only.</p>
      </aside>
    </div>
  );
}
