import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Users } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { CourtFinder } from "@/components/community/court-finder";
import { ListingForm } from "@/components/community/listing-form";
import { LEVELS } from "@/components/community/levels";
import { closeListing } from "@/app/actions/community";

export const metadata: Metadata = {
  title: "Find a padel game near you",
  description: "Find padel courts across the UK and post on our community board to find players at your level.",
};
export const dynamic = "force-dynamic";

export default async function FindAGamePage({ searchParams }: { searchParams: Promise<{ city?: string; level?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const [venues, listings] = await Promise.all([
    db.venue.findMany({ orderBy: [{ region: "asc" }, { city: "asc" }] }),
    db.gameListing.findMany({
      where: {
        status: "OPEN",
        playDate: { gte: new Date() },
        ...(sp.city ? { city: { contains: sp.city, mode: "insensitive" } } : {}),
        ...(sp.level ? { level: sp.level } : {}),
      },
      orderBy: { playDate: "asc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);
  return (
    <div className="container-page py-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Find a game</h1>
        <p className="mt-2 text-muted">Find courts near you, then book and join open matches on Playtomic — or post on our community board to find players at your level.</p>
      </header>

      <section aria-labelledby="pt-title" className="mt-8 grid gap-4 rounded-2xl bg-brand-900 p-6 text-white md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 id="pt-title" className="text-xl font-bold">Book courts & join open matches on Playtomic</h2>
          <p className="mt-1 text-sm text-white/80">Most UK clubs take bookings through Playtomic, where you can also join open matches matched to your level.</p>
        </div>
        <a href="https://playtomic.com/" target="_blank" rel="noopener noreferrer" className="btn-accent">
          Open Playtomic <ExternalLink className="size-4" aria-hidden /><span className="sr-only">(opens in new tab)</span>
        </a>
      </section>

      <section aria-labelledby="courts-title" className="mt-12">
        <h2 id="courts-title" className="mb-4 text-2xl font-extrabold">Court finder</h2>
        <CourtFinder venues={venues} />
        <p className="mt-3 text-xs text-muted">Venues marked “example” are illustrative demo data — always check opening times and booking with the venue.</p>
      </section>

      <section aria-labelledby="board-title" className="mt-14 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <h2 id="board-title" className="flex items-center gap-2 text-2xl font-extrabold"><Users className="size-6" aria-hidden /> Looking for players</h2>
          <form className="mt-4 flex flex-wrap gap-2">
            <label htmlFor="lf-city" className="sr-only">City</label>
            <input id="lf-city" name="city" defaultValue={sp.city} placeholder="Filter by city" className="input max-w-48" />
            <label htmlFor="lf-level" className="sr-only">Level</label>
            <select id="lf-level" name="level" defaultValue={sp.level ?? ""} className="input max-w-52">
              <option value="">All levels</option>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
            <button className="btn-outline btn-sm">Filter</button>
          </form>
          <ul className="mt-4 space-y-3">
            {listings.length === 0 && <li className="card p-6 text-sm text-muted">No open games match. Why not post one?</li>}
            {listings.map((l) => (
              <li key={l.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{l.title}</p>
                    <p className="text-sm text-muted">{formatDate(l.playDate, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {l.city}{l.venueName ? ` · ${l.venueName}` : ""}</p>
                  </div>
                  <span className="badge bg-lime-accent text-brand-950">{l.playersNeeded} needed</span>
                </div>
                <p className="mt-2 text-sm">{l.description}</p>
                <p className="mt-2 text-xs text-muted">Level: <strong>{l.level}</strong> · Posted by {l.user.name?.split(" ")[0] ?? "a player"} · Contact: <strong className="text-ink">{l.contact}</strong></p>
                {session?.user?.id === l.userId && (
                  <form action={closeListing} className="mt-2"><input type="hidden" name="id" value={l.id} /><button className="text-xs font-semibold text-brand-700 underline">Mark as filled</button></form>
                )}
              </li>
            ))}
          </ul>
        </div>
        <aside className="card h-fit p-6">
          <h2 className="text-lg font-bold">Post a game</h2>
          {session?.user ? (
            <div className="mt-4"><ListingForm /></div>
          ) : (
            <p className="mt-2 text-sm text-muted"><Link href="/account/login?callbackUrl=/find-a-game" className="font-semibold text-brand-700 underline">Sign in</Link> or <Link href="/account/register?callbackUrl=/find-a-game" className="font-semibold text-brand-700 underline">create a free account</Link> to post on the board.</p>
          )}
          <p className="mt-4 text-xs text-muted">Be kind and play fair. Listings are moderated and removed after the game date. Report anything inappropriate via <Link href="/contact" className="underline">contact us</Link>.</p>
        </aside>
      </section>
    </div>
  );
}
