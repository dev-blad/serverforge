import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account", description: "Create a Courtline Padel account for faster checkout, saved cards and order history." };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; email?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-extrabold">Create an account</h1>
        <p className="mt-1 text-muted">Faster checkout with saved addresses and cards, order history and one-tap reordering.</p>
        <RegisterForm callbackUrl={sp.callbackUrl?.startsWith("/") ? sp.callbackUrl : "/account"} defaultEmail={sp.email} />
      </div>
    </div>
  );
}
