"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, CreditCard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useCart } from "@/components/providers/cart-provider";
import { PromoCodeForm } from "@/components/cart/promo-code-form";
import { CartSummary } from "@/components/cart/cart-summary";
import { FreeShippingBar } from "@/components/cart/free-shipping-bar";
import { formatPrice } from "@/lib/money";
import type { ShippingMethod } from "@/lib/shipping-rates";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping-rates";

interface Addr { id?: string; label?: string | null; name: string; line1: string; line2: string; city: string; county: string; postcode: string; phone: string }
interface SavedCard { id: string; brand: string; last4: string; expMonth: number; expYear: number; wallet: string | null }
type PaymentState =
  | { status: "simulated"; orderId: string; orderNumber: string; total: number }
  | { status: "requires_payment"; orderId: string; orderNumber: string; total: number; clientSecret: string; customerSessionClientSecret: string | null; savedCards: SavedCard[] };

const EMPTY: Addr = { name: "", line1: "", line2: "", city: "", county: "", postcode: "", phone: "" };
let stripePromise: Promise<Stripe | null> | null = null;

export function CheckoutClient({ user, addresses, methods, stripeKey, simulated }: { user: { email: string; name: string } | null; addresses: Addr[]; methods: ShippingMethod[]; stripeKey: string | null; simulated: boolean }) {
  const { cart, loading, refresh } = useCart();
  const router = useRouter();
  const [email, setEmail] = useState(user?.email ?? "");
  const [addrId, setAddrId] = useState<string>(addresses[0]?.id ?? "new");
  const [addr, setAddr] = useState<Addr>(addresses[0] ?? { ...EMPTY, name: user?.name ?? "" });
  const [method, setMethod] = useState(methods[0]!.id);
  const [note, setNote] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<PaymentState | null>(null);

  useEffect(() => {
    void refresh(method);
  }, [method, refresh]);

  const discounted = cart ? cart.totals.subtotal - cart.totals.discountTotal : 0;
  const methodPrice = (m: ShippingMethod) => (m.freeEligible && discounted >= FREE_SHIPPING_THRESHOLD) || cart?.discountCode === "FREESHIP" ? 0 : m.price;

  if (loading) return <p className="mt-6 text-muted">Loading…</p>;
  if (!cart?.items.length && !payment)
    return (
      <div className="card mt-6 p-10 text-center">
        <p className="font-semibold">Your basket is empty</p>
        <Link href="/c/rackets" className="btn-primary mt-4">Continue shopping</Link>
      </div>
    );

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, address: { name: addr.name, line1: addr.line1, line2: addr.line2, city: addr.city, county: addr.county, postcode: addr.postcode, phone: addr.phone }, shippingMethodId: method, customerNote: note || undefined, marketingOptIn: marketing, saveAddress: user && addrId === "new" ? saveAddress : false }),
    });
    const data = (await res.json()) as (PaymentState | { status: "paid"; orderId: string }) & { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    if (data.status === "paid") return router.push(`/checkout/complete?order=${data.orderId}`);
    setPayment(data as PaymentState);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const field = (k: keyof Addr, label: string, auto: string, opts: { required?: boolean; span?: boolean; inputMode?: "tel" } = {}) => (
    <div className={opts.span ? "sm:col-span-2" : ""}>
      <label htmlFor={`co-${k}`} className="label">{label}{!opts.required && <span className="font-normal text-muted"> (optional)</span>}</label>
      <input id={`co-${k}`} required={opts.required} autoComplete={auto} inputMode={opts.inputMode} value={addr[k] ?? ""} onChange={(e) => { setAddr({ ...addr, [k]: e.target.value }); setAddrId("new"); }} className="input" />
    </div>
  );

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_400px]">
      <div>
        <ol className="mb-6 flex items-center gap-2 text-sm" aria-label="Checkout steps">
          <li className={`font-semibold ${payment ? "text-muted" : ""}`} aria-current={!payment ? "step" : undefined}>1. Delivery</li>
          <li aria-hidden className="text-muted">→</li>
          <li className={`font-semibold ${payment ? "" : "text-muted"}`} aria-current={payment ? "step" : undefined}>2. Payment</li>
        </ol>

        {!payment ? (
          <form onSubmit={submitDetails} className="space-y-8">
            <section className="card p-6">
              <h2 className="text-lg font-bold">Contact</h2>
              {!user && (
                <p className="mt-1 text-sm text-muted">
                  Checking out as a guest. <Link href="/account/login?callbackUrl=/checkout" className="font-semibold text-brand-700 underline">Sign in</Link> for saved addresses and one-tap card payments.
                </p>
              )}
              <div className="mt-4">
                <label htmlFor="co-email" className="label">Email for order updates</label>
                <input id="co-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 size-4 accent-brand-900" />
                <span>Email me new arrivals and offers (optional)</span>
              </label>
            </section>

            <section className="card p-6">
              <h2 className="text-lg font-bold">Delivery address</h2>
              <p className="mt-1 text-sm text-muted">We currently deliver to UK mainland addresses.</p>
              {addresses.length > 0 && (
                <div className="mt-4">
                  <label htmlFor="co-saved" className="label">Saved addresses</label>
                  <select id="co-saved" className="input" value={addrId} onChange={(e) => { const a = addresses.find((x) => x.id === e.target.value); setAddrId(e.target.value); setAddr(a ?? { ...EMPTY, name: user?.name ?? "" }); }}>
                    {addresses.map((a) => (
                      <option key={a.id} value={a.id}>{a.label ? `${a.label} — ` : ""}{a.line1}, {a.postcode}</option>
                    ))}
                    <option value="new">Use a new address</option>
                  </select>
                </div>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {field("name", "Full name", "shipping name", { required: true, span: true })}
                {field("line1", "Address line 1", "shipping address-line1", { required: true, span: true })}
                {field("line2", "Address line 2", "shipping address-line2", { span: true })}
                {field("city", "Town / city", "shipping address-level2", { required: true })}
                {field("county", "County", "shipping address-level1")}
                {field("postcode", "Postcode", "shipping postal-code", { required: true })}
                {field("phone", "Phone (for delivery updates)", "shipping tel", { inputMode: "tel" })}
              </div>
              {user && addrId === "new" && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="size-4 accent-brand-900" /> Save this address to my account
                </label>
              )}
            </section>

            <section className="card p-6">
              <fieldset>
                <legend className="text-lg font-bold">Delivery method</legend>
                <div className="mt-4 space-y-2">
                  {methods.map((m) => {
                    const price = methodPrice(m);
                    return (
                      <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${method === m.id ? "border-brand-900 ring-1 ring-brand-900" : "border-line"}`}>
                        <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="size-4 accent-brand-900" />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">{m.name}</span>
                          <span className="block text-xs text-muted">{m.description}</span>
                        </span>
                        <span className="text-sm font-semibold">{price === 0 ? "Free" : formatPrice(price)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="mt-4">
                <label htmlFor="co-note" className="label">Delivery note <span className="font-normal text-muted">(optional)</span></label>
                <input id="co-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="e.g. leave with neighbour at no. 12" />
              </div>
            </section>

            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-sale">{error}</p>}
            <button className="btn-primary w-full text-base" disabled={busy}>
              {busy ? "Please wait…" : "Continue to payment"}
            </button>
          </form>
        ) : payment.status === "simulated" ? (
          <SimulatedPayment payment={payment} onBack={() => setPayment(null)} />
        ) : (
          <StripePayment payment={payment} stripeKey={stripeKey!} email={email} onBack={() => setPayment(null)} />
        )}
        {!stripeKey && simulated && !payment && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Demo store: Stripe isn&apos;t connected yet, so payment will be simulated on the next step.</p>
        )}
      </div>

      <aside className="card h-fit space-y-5 p-6 lg:sticky lg:top-32" aria-label="Order summary">
        <h2 className="text-lg font-bold">Order summary</h2>
        {cart && (
          <>
            <ul className="space-y-3">
              {cart.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-canvas">
                    {i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" unoptimized />}
                    <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-brand-900 text-[10px] font-bold text-white">{i.quantity}</span>
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-muted">{i.variantName}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatPrice(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            {!payment && <PromoCodeForm />}
            <FreeShippingBar remaining={cart.totals.freeShippingRemaining} />
            <CartSummary totals={cart.totals} shippingLabel={methods.find((m) => m.id === method)?.name ?? "Delivery"} />
          </>
        )}
        <p className="flex items-center gap-2 text-xs text-muted"><Lock className="size-3.5" aria-hidden /> Secure, encrypted checkout powered by Stripe</p>
      </aside>
    </div>
  );
}

function SimulatedPayment({ payment, onBack }: { payment: Extract<PaymentState, { status: "simulated" }>; onBack: () => void }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pay = async (outcome: "success" | "decline") => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: payment.orderId, outcome }) });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Payment failed");
    await refresh();
    router.push(`/checkout/complete?order=${payment.orderId}`);
  };
  return (
    <section className="card space-y-4 p-6">
      <h2 className="text-lg font-bold">Payment</h2>
      <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Demo payment mode</p>
        <p className="mt-1">Stripe keys aren&apos;t configured, so this step simulates a card payment. The rest of the flow (order, stock, emails, label, printing) runs for real. Add Stripe test keys to switch to the live Payment Element with Apple Pay, Google Pay and Link.</p>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-line p-4">
        <CreditCard className="size-5 text-muted" aria-hidden />
        <span className="text-sm">Test card VISA •••• 4242</span>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-sale">{error}</p>}
      <button type="button" className="btn-primary w-full text-base" disabled={busy} onClick={() => pay("success")}>
        {busy ? "Processing…" : `Pay ${formatPrice(payment.total)}`}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-muted underline" onClick={onBack}>← Edit delivery details</button>
        <button type="button" className="text-muted underline" onClick={() => pay("decline")} disabled={busy}>Simulate a declined card</button>
      </div>
    </section>
  );
}

function StripePayment({ payment, stripeKey, email, onBack }: { payment: Extract<PaymentState, { status: "requires_payment" }>; stripeKey: string; email: string; onBack: () => void }) {
  stripePromise ??= loadStripe(stripeKey);
  const options = useMemo(
    () => ({
      clientSecret: payment.clientSecret,
      ...(payment.customerSessionClientSecret ? { customerSessionClientSecret: payment.customerSessionClientSecret } : {}),
      appearance: { theme: "stripe" as const, variables: { colorPrimary: "#0d3b2e", borderRadius: "8px", fontFamily: "Inter, system-ui, sans-serif" } },
    }),
    [payment.clientSecret, payment.customerSessionClientSecret],
  );
  return (
    <Elements stripe={stripePromise} options={options}>
      <StripeForm payment={payment} email={email} onBack={onBack} />
    </Elements>
  );
}

function StripeForm({ payment, email, onBack }: { payment: Extract<PaymentState, { status: "requires_payment" }>; email: string; onBack: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { refresh } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnUrl = `${window.location.origin}/checkout/complete?order=${payment.orderId}`;

  const done = async () => {
    await refresh();
    router.push(`/checkout/complete?order=${payment.orderId}`);
  };

  const payWithSaved = async (pmId: string) => {
    if (!stripe) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout/saved-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: payment.orderId, paymentMethodId: pmId }) });
    const data = (await res.json()) as { status?: string; clientSecret?: string; error?: string };
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Payment failed");
    }
    if (data.status === "requires_action" && data.clientSecret) {
      const r = await stripe.handleNextAction({ clientSecret: data.clientSecret });
      if (r.error) {
        setBusy(false);
        return setError(r.error.message ?? "Authentication failed");
      }
    }
    await done();
  };

  return (
    <section className="card space-y-5 p-6">
      <h2 className="text-lg font-bold">Payment</h2>
      {payment.savedCards.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">One-click pay with a saved card</p>
          <div className="space-y-2">
            {payment.savedCards.map((c) => (
              <button key={c.id} type="button" disabled={busy || !stripe} onClick={() => payWithSaved(c.id)} className="btn-primary w-full justify-between">
                <span className="capitalize">{c.brand} •••• {c.last4} <span className="font-normal opacity-80">exp {String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}</span></span>
                <span>Pay {formatPrice(payment.total)}</span>
              </button>
            ))}
          </div>
          <div className="my-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or pay another way<span className="h-px flex-1 bg-line" /></div>
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!stripe || !elements) return;
          setBusy(true);
          setError(null);
          const { error: err, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl, receipt_email: email },
            redirect: "if_required",
          });
          if (err) {
            setBusy(false);
            return setError(err.message ?? "Payment failed");
          }
          if (paymentIntent && ["succeeded", "processing"].includes(paymentIntent.status)) await done();
          else setBusy(false);
        }}
        className="space-y-5"
      >
        <PaymentElement options={{ layout: { type: "tabs" }, defaultValues: { billingDetails: { email } }, wallets: { applePay: "auto", googlePay: "auto" } }} />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-sale">{error}</p>}
        <button className="btn-primary w-full text-base" disabled={busy || !stripe}>
          <Lock className="size-4" aria-hidden /> {busy ? "Processing…" : `Pay ${formatPrice(payment.total)}`}
        </button>
      </form>
      <button type="button" className="text-sm text-muted underline" onClick={onBack}>← Edit delivery details</button>
    </section>
  );
}
