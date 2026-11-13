import type { Metadata } from "next";
import Link from "next/link";
import { Gift } from "lucide-react";

export const metadata: Metadata = { title: "Gift cards", description: "Courtline Padel digital gift cards — the perfect present for padel players." };

export default function GiftCardsPage() {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-brand-900 text-white">
        <div className="p-8 sm:p-12">
          <Gift className="size-10 text-lime-accent" aria-hidden />
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Digital gift cards</h1>
          <p className="mt-3 text-white/80">
            The easy present for the padel player in your life. Digital gift cards from £10 to £250, delivered by email and valid for 24 months.
          </p>
          <p className="mt-6 inline-block rounded-full bg-lime-accent px-4 py-1.5 text-sm font-bold text-brand-950">Buying gift cards online — coming soon</p>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-3xl space-y-4">
        <h2 className="text-xl font-extrabold">Already have a gift card?</h2>
        <p className="text-ink/80">
          Enter your gift card code in the <strong>discount or gift card code</strong> box in your basket or at checkout. Any remaining balance stays on the card for next time.
        </p>
        <p className="text-sm text-muted">Want to buy gift cards for a club or team in the meantime? <Link href="/contact" className="font-semibold text-brand-700 underline">Get in touch</Link> and we&apos;ll sort it.</p>
      </div>
    </div>
  );
}
