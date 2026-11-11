import { requireUser } from "@/lib/session";
import { deleteAccount } from "@/app/actions/account";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata = { title: "Settings & privacy" };

export default async function SettingsPage() {
  const user = await requireUser("/account/settings");
  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-lg font-bold">Your details</h2>
        <ProfileForm name={user.name ?? ""} email={user.email} marketing={user.marketingOptIn} hasPassword={Boolean(user.passwordHash)} />
      </section>
      <section className="card p-6">
        <h2 className="text-lg font-bold">Your data</h2>
        <p className="mt-1 text-sm text-muted">Under UK GDPR you can download a copy of the personal data we hold about you, or ask us to delete your account.</p>
        <a href="/api/account/export" className="btn-outline btn-sm mt-4">Download my data (JSON)</a>
        <form action={deleteAccount} className="mt-6 rounded-lg border border-red-200 p-4">
          <p className="text-sm font-semibold text-sale">Delete my account</p>
          <p className="mt-1 text-xs text-muted">This removes your account, addresses and wishlist. Order records are kept (anonymised from your account) for 6 years as required by HMRC.</p>
          <label htmlFor="confirm" className="label mt-3">Type DELETE to confirm</label>
          <div className="flex gap-2">
            <input id="confirm" name="confirm" className="input max-w-40" pattern="DELETE" required />
            <button className="btn btn-sm bg-sale text-white">Delete account</button>
          </div>
        </form>
      </section>
    </div>
  );
}
