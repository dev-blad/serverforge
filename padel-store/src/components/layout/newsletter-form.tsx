"use client";

import { useActionState } from "react";
import { subscribeNewsletter, type FormState } from "@/app/actions/newsletter";

export function NewsletterForm({ source = "footer", dark = false }: { source?: string; dark?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeNewsletter, null);
  return (
    <form action={action} className="w-full">
      <input type="hidden" name="source" value={source} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`nl-${source}`} className="sr-only">
          Email address
        </label>
        <input id={`nl-${source}`} name="email" type="email" required placeholder="you@example.com" className="input" autoComplete="email" />
        <button className={dark ? "btn-accent shrink-0" : "btn-primary shrink-0"} disabled={pending}>
          {pending ? "Signing up…" : "Sign up"}
        </button>
      </div>
      <p role="status" className={`mt-2 min-h-5 text-xs ${state ? (state.ok ? (dark ? "text-lime-accent" : "text-brand-600") : "text-red-300") : dark ? "text-white/70" : "text-muted"}`}>
        {state?.message ?? "10% off your first order. Unsubscribe anytime — see our privacy policy."}
      </p>
    </form>
  );
}
