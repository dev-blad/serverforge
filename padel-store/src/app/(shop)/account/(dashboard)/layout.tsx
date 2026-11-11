import Link from "next/link";
import { requireUser } from "@/lib/session";
import { signOutAction } from "@/app/actions/account";
import { AccountNav } from "@/components/account/account-nav";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">My account</p>
          <h1 className="text-3xl font-extrabold">Hi {user.name?.split(" ")[0] ?? "there"} 👋</h1>
        </div>
        {user.role === "ADMIN" && <Link href="/admin" className="btn-primary btn-sm">Go to admin dashboard</Link>}
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_1fr]">
        <div>
          <AccountNav />
          <form action={signOutAction} className="mt-2">
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-canvas">Sign out</button>
          </form>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
