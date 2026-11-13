"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { registerUser, type RegisterState } from "@/app/actions/auth";

export function RegisterForm({ callbackUrl, defaultEmail }: { callbackUrl: string; defaultEmail?: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerUser, null);
  const [password, setPassword] = useState("");
  useEffect(() => {
    if (state?.ok && state.email) {
      void signIn("credentials", { email: state.email, password, redirect: false }).then(() => {
        window.location.href = callbackUrl;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when the action result changes
  }, [state, callbackUrl]);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="name" className="label">Full name</label>
        <input id="name" name="name" autoComplete="name" required defaultValue={state?.values?.name} className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email ?? defaultEmail} className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} id="password" name="password" type="password" autoComplete="new-password" required minLength={10} aria-describedby="pw-hint" className="input" />
        <p id="pw-hint" className="mt-1 text-xs text-muted">At least 10 characters, including a letter and a number.</p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="marketing" className="mt-0.5 size-4 accent-brand-900" />
        <span>Email me new arrivals and offers (optional — unsubscribe anytime).</span>
      </label>
      {state && !state.ok && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-sale">{state.message}</p>}
      <button className="btn-primary w-full" disabled={pending || state?.ok}>{pending || state?.ok ? "Creating account…" : "Create account"}</button>
      <p className="text-xs text-muted">
        By creating an account you agree to our <Link href="/policies/terms" className="underline">terms</Link> and acknowledge our <Link href="/policies/privacy" className="underline">privacy policy</Link>.
      </p>
      <p className="text-center text-sm">
        Already have an account? <Link href="/account/login" className="font-semibold text-brand-700 underline">Sign in</Link>
      </p>
    </form>
  );
}
