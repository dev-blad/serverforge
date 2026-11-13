"use client";

import { useActionState } from "react";
import { postListing, type CommunityState } from "@/app/actions/community";

import { LEVELS } from "./levels";

export function ListingForm() {
  const [state, action, pending] = useActionState<CommunityState, FormData>(postListing, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><label htmlFor="gl-title" className="label">Title</label><input id="gl-title" name="title" required maxLength={80} className="input" placeholder="Need a 4th for Thursday doubles" /></div>
      <div><label htmlFor="gl-city" className="label">Town / city</label><input id="gl-city" name="city" required className="input" /></div>
      <div><label htmlFor="gl-venue" className="label">Venue <span className="font-normal text-muted">(optional)</span></label><input id="gl-venue" name="venueName" className="input" /></div>
      <div><label htmlFor="gl-level" className="label">Level</label><select id="gl-level" name="level" className="input">{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></div>
      <div><label htmlFor="gl-players" className="label">Players needed</label><select id="gl-players" name="playersNeeded" className="input">{[1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></div>
      <div className="sm:col-span-2"><label htmlFor="gl-date" className="label">Date & time</label><input id="gl-date" name="playDate" type="datetime-local" required className="input" /></div>
      <div className="sm:col-span-2"><label htmlFor="gl-desc" className="label">Details</label><textarea id="gl-desc" name="description" required rows={3} className="input" placeholder="Court booked, split the cost, bring your own racket…" /></div>
      <div className="sm:col-span-2">
        <label htmlFor="gl-contact" className="label">How should players contact you?</label>
        <input id="gl-contact" name="contact" required className="input" placeholder="e.g. Playtomic name, Instagram handle or email" aria-describedby="gl-contact-hint" />
        <p id="gl-contact-hint" className="mt-1 text-xs text-muted">This is shown publicly — don&apos;t share anything you&apos;re not comfortable with.</p>
      </div>
      {state && <p role="status" className={`text-sm sm:col-span-2 ${state.ok ? "text-brand-600" : "text-sale"}`}>{state.message}</p>}
      <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{pending ? "Posting…" : "Post listing"}</button></div>
    </form>
  );
}
