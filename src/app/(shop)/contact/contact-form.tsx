"use client";

import { useActionState } from "react";
import { submitContact, type SupportState } from "@/app/actions/support";

export function ContactForm() {
  const [state, action, pending] = useActionState<SupportState, FormData>(submitContact, null);
  if (state?.ok) return <p role="status" className="card mt-6 p-6 font-semibold text-brand-700">{state.message}</p>;
  return (
    <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      <div><label htmlFor="c-name" className="label">Name</label><input id="c-name" name="name" required autoComplete="name" className="input" /></div>
      <div><label htmlFor="c-email" className="label">Email</label><input id="c-email" name="email" type="email" required autoComplete="email" className="input" /></div>
      <div><label htmlFor="c-subject" className="label">Subject</label>
        <select id="c-subject" name="subject" className="input">
          {["Product advice", "My order", "Returns & refunds", "Club / bulk order", "Something else"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div><label htmlFor="c-order" className="label">Order number <span className="font-normal text-muted">(optional)</span></label><input id="c-order" name="orderNumber" className="input" placeholder="CL-10042" /></div>
      <div className="sm:col-span-2"><label htmlFor="c-msg" className="label">Message</label><textarea id="c-msg" name="message" required minLength={10} rows={6} className="input" /></div>
      {state && !state.ok && <p role="alert" className="text-sm text-sale sm:col-span-2">{state.message}</p>}
      <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send message"}</button></div>
    </form>
  );
}
