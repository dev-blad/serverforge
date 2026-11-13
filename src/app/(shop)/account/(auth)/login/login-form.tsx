"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";

const ERRORS: Record<string, string> = {
  CredentialsSignin: "Email or password is incorrect.",
  OAuthAccountNotLinked: "That email is already linked to another sign-in method.",
  Verification: "That sign-in link has expired or already been used.",
};

export function LoginForm({ callbackUrl, google, error }: { callbackUrl: string; google: boolean; error?: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [msg, setMsg] = useState<string | null>(error ? (ERRORS[error] ?? "Sign-in failed, please try again.") : null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-6 space-y-5">
      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 rounded-lg bg-canvas p-1 text-sm font-semibold">
        {(["password", "link"] as const).map((m) => (
          <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => { setMode(m); setMsg(null); }} className={`rounded-md py-2 ${mode === m ? "bg-white shadow-sm" : "text-muted"}`}>
            {m === "password" ? "Password" : "Email me a link"}
          </button>
        ))}
      </div>

      {mode === "password" ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg(null);
            const fd = new FormData(e.currentTarget);
            const res = await signIn("credentials", { email: fd.get("email"), password: fd.get("password"), redirect: false });
            if (res?.error) {
              setMsg(ERRORS.CredentialsSignin!);
              setBusy(false);
            } else {
              window.location.href = callbackUrl;
            }
          }}
        >
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-xs text-muted">Forgotten your password? Use “Email me a link” to sign in, then set a new password in your account settings.</p>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            await signIn("email", { email: fd.get("email"), callbackUrl });
          }}
        >
          <div>
            <label htmlFor="link-email" className="label">Email</label>
            <input id="link-email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Send me a sign-in link"}</button>
        </form>
      )}

      {msg && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-sale">{msg}</p>}

      {google && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <button type="button" className="btn-outline w-full" onClick={() => signIn("google", { callbackUrl })}>
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.4 24 12 24z" />
              <path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6h-4C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.4 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
            </svg>
            Continue with Google
          </button>
        </>
      )}
      <p className="text-center text-sm">
        New here? <Link href={`/account/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="font-semibold text-brand-700 underline">Create an account</Link>
      </p>
    </div>
  );
}
