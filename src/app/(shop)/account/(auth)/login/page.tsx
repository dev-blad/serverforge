import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { features } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to your Courtline Padel account to track orders, reorder in one tap and check out faster." };

type Props = { searchParams: Promise<{ callbackUrl?: string; check?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl?.startsWith("/") ? sp.callbackUrl : "/account";
  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-extrabold">Sign in</h1>
        <p className="mt-1 text-muted">Track orders, save addresses and check out faster.</p>
        {sp.check === "email" ? (
          <div role="status" className="card mt-6 p-6">
            <p className="font-semibold">Check your inbox 📬</p>
            <p className="mt-1 text-sm text-muted">We&apos;ve emailed you a sign-in link. It expires in 24 hours.</p>
          </div>
        ) : (
          <LoginForm callbackUrl={callbackUrl} google={features.google} error={sp.error} />
        )}
      </div>
    </div>
  );
}
