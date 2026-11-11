"use client";

import { useActionState } from "react";
import { submitReturn, type SupportState } from "@/app/actions/support";

export function ReturnForm({ defaultOrder }: { defaultOrder: string }) {
  const [state, action, pending] = useActionState<SupportState, FormData>(submitReturn, null);
  if (state?.ok) return <p role="status" className="card mt-6 p-6 font-semibold text-brand-700">{state.message}</p>;
  return (
    <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
      <div><label htmlFor="r-order" className="label">Order number</label><input id="r-order" name="orderNumber" required defaultValue={defaultOrder} className="input uppercase" placeholder="CL-10042" /></div>
      <div><label htmlFor="r-email" className="label">Email used for the order</label><input id="r-email" name="email" type="email" required autoComplete="email" className="input" /></div>
      <div className="sm:col-span-2"><label htmlFor="r-items" className="label">Which items are you returning?</label><textarea id="r-items" name="items" required rows={3} className="input" placeholder="e.g. 1 × Kestrel Apex Carbon 18K (Black / Orange)" /></div>
      <div><label htmlFor="r-reason" className="label">Reason</label>
        <select id="r-reason" name="reason" className="input">
          <option value="changed-mind">Changed my mind</option>
          <option value="wrong-size">Wrong size / fit</option>
          <option value="faulty">Faulty</option>
          <option value="not-as-described">Not as described</option>
          <option value="arrived-damaged">Arrived damaged</option>
          <option value="other">Other</option>
        </select>
      </div>
      <fieldset><legend className="label">I&apos;d like</legend>
        <div className="flex gap-4 pt-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="resolution" value="refund" defaultChecked className="accent-brand-900" /> A refund</label>
          <label className="flex items-center gap-2"><input type="radio" name="resolution" value="exchange" className="accent-brand-900" /> An exchange</label>
        </div>
      </fieldset>
      <div className="sm:col-span-2"><label htmlFor="r-comments" className="label">Anything else? <span className="font-normal text-muted">(optional)</span></label><textarea id="r-comments" name="comments" rows={3} className="input" /></div>
      {state && !state.ok && <p role="alert" className="text-sm text-sale sm:col-span-2">{state.message}</p>}
      <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{pending ? "Submitting…" : "Submit return request"}</button></div>
    </form>
  );
}
