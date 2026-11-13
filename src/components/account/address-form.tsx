"use client";

import type { Address } from "@prisma/client";
import { useActionState } from "react";
import { saveAddress, type AccountState } from "@/app/actions/account";

export function AddressForm({ address }: { address?: Address }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveAddress, null);
  const id = address?.id ?? "new";
  const f = (name: keyof Address, label: string, opts: { required?: boolean; auto?: string; className?: string } = {}) => (
    <div className={opts.className}>
      <label htmlFor={`${id}-${name}`} className="label">{label}{!opts.required && <span className="font-normal text-muted"> (optional)</span>}</label>
      <input id={`${id}-${name}`} name={name} required={opts.required} autoComplete={opts.auto} defaultValue={(address?.[name] as string | null) ?? ""} className="input" />
    </div>
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {address && <input type="hidden" name="id" value={address.id} />}
      {f("label", "Label (e.g. Home)")}
      {f("name", "Full name", { required: true, auto: "name" })}
      {f("line1", "Address line 1", { required: true, auto: "address-line1", className: "sm:col-span-2" })}
      {f("line2", "Address line 2", { auto: "address-line2", className: "sm:col-span-2" })}
      {f("city", "Town / city", { required: true, auto: "address-level2" })}
      {f("county", "County")}
      {f("postcode", "Postcode", { required: true, auto: "postal-code" })}
      {f("phone", "Phone", { auto: "tel" })}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} className="size-4 accent-brand-900" /> Set as default address
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save address"}</button>
        {state && <p role="status" className={`text-sm ${state.ok ? "text-brand-600" : "text-sale"}`}>{state.message}</p>}
      </div>
    </form>
  );
}
