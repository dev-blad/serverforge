import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { deleteAddress } from "@/app/actions/account";
import { AddressForm } from "@/components/account/address-form";

export const metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Saved addresses</h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className="card p-5">
            <p className="font-semibold">
              {a.label ?? "Address"} {a.isDefault && <span className="badge ml-1 bg-brand-50 text-brand-800">Default</span>}
            </p>
            <address className="mt-2 text-sm not-italic text-ink/80">{[a.name, a.line1, a.line2, a.city, a.county, a.postcode, a.phone].filter(Boolean).join(", ")}</address>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand-700">Edit</summary>
              <div className="mt-3"><AddressForm address={a} /></div>
            </details>
            <form action={deleteAddress} className="mt-2">
              <input type="hidden" name="id" value={a.id} />
              <button className="text-sm text-sale underline">Delete</button>
            </form>
          </li>
        ))}
      </ul>
      <section className="card p-6">
        <h3 className="mb-4 font-bold">Add a new address</h3>
        <AddressForm />
      </section>
    </div>
  );
}
