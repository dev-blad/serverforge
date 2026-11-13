import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { features } from "@/lib/config";
import { SHIPPING_METHODS } from "@/lib/shipping-rates";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await auth();
  const user = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id }, include: { addresses: { orderBy: { isDefault: "desc" } } } }) : null;
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-extrabold">Checkout</h1>
      <CheckoutClient
        user={user ? { email: user.email, name: user.name ?? "" } : null}
        addresses={(user?.addresses ?? []).map((a) => ({ id: a.id, label: a.label, name: a.name, line1: a.line1, line2: a.line2 ?? "", city: a.city, county: a.county ?? "", postcode: a.postcode, phone: a.phone ?? "" }))}
        methods={SHIPPING_METHODS}
        stripeKey={features.stripe ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY! : null}
        simulated={features.simulatedPayments}
      />
    </div>
  );
}
