import { requireUser } from "@/lib/session";
import { listSavedCards } from "@/lib/stripe";
import { features } from "@/lib/config";
import { removeCard } from "@/app/actions/account";

export const metadata = { title: "Payment methods" };

export default async function PaymentMethodsPage() {
  const user = await requireUser("/account/payment-methods");
  const cards = await listSavedCards(user.stripeCustomerId);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Saved payment methods</h2>
      <p className="text-sm text-muted">
        Cards are stored securely by Stripe — we never see or store your full card number. Tick “Save for future purchases” at checkout to add a card,
        then pay in one tap next time.
      </p>
      {!features.stripe && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Card payments are running in demo mode, so no cards can be saved yet.</p>}
      {cards.length === 0 ? (
        <p className="card p-6 text-sm text-muted">No saved cards yet.</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => (
            <li key={c.id} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-semibold capitalize">{c.brand} •••• {c.last4}</p>
                <p className="text-xs text-muted">Expires {String(c.expMonth).padStart(2, "0")}/{c.expYear}{c.wallet ? ` · via ${c.wallet.replace("_", " ")}` : ""}</p>
              </div>
              <form action={removeCard}>
                <input type="hidden" name="pm" value={c.id} />
                <button className="text-sm text-sale underline">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
