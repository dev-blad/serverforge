"use client";

import { useActionState } from "react";
import { updateProfile, type AccountState } from "@/app/actions/account";

export function ProfileForm({ name, email, marketing, hasPassword }: { name: string; email: string; marketing: boolean; hasPassword: boolean }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateProfile, null);
  return (
    <form action={action} className="mt-4 grid max-w-lg gap-4">
      <div>
        <label htmlFor="pf-name" className="label">Name</label>
        <input id="pf-name" name="name" defaultValue={name} required className="input" autoComplete="name" />
      </div>
      <div>
        <label htmlFor="pf-email" className="label">Email</label>
        <input id="pf-email" value={email} disabled className="input bg-canvas" />
      </div>
      <div>
        <label htmlFor="pf-password" className="label">{hasPassword ? "New password" : "Set a password"} <span className="font-normal text-muted">(optional)</span></label>
        <input id="pf-password" name="password" type="password" autoComplete="new-password" className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="marketing" defaultChecked={marketing} className="size-4 accent-brand-900" /> Email me offers and new arrivals
      </label>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
        {state && <p role="status" className={`text-sm ${state.ok ? "text-brand-600" : "text-sale"}`}>{state.message}</p>}
      </div>
    </form>
  );
}
