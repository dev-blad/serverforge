import type { Metadata } from "next";
import Link from "next/link";
import { ReturnForm } from "./return-form";

export const metadata: Metadata = { title: "Start a return", description: "Return unused items within 30 days for a full refund." };

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-3xl font-extrabold">Start a return</h1>
        <p className="mt-2 text-muted">Return unused items within 30 days of delivery for a refund or exchange.</p>
        <ReturnForm defaultOrder={sp.order ? `CL-${10000 + Number(sp.order)}` : ""} />
      </div>
      <aside className="card h-fit space-y-3 p-6 text-sm">
        <h2 className="font-bold">How returns work</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Submit this form — we&apos;ll email you within one working day.</li>
          <li>Pack items unused, with tags and in original packaging.</li>
          <li>Drop off with the label we send (free for faulty items).</li>
          <li>We refund within 5 working days of receiving your return.</li>
        </ol>
        <p className="text-xs text-muted">Your statutory 14-day right to cancel is unaffected. <Link href="/policies/returns" className="underline">Full returns policy</Link>.</p>
      </aside>
    </div>
  );
}
