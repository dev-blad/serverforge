import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [toPack, pendingReviews, openChats, unhandled] = await Promise.all([
    db.order.count({ where: { status: { in: ["PAID", "PACKED"] } } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.chatConversation.count({ where: { status: "OPEN", messages: { some: {} } } }),
    db.contactMessage.count({ where: { handled: false } }),
  ]);
  const returns = await db.returnRequest.count({ where: { status: "REQUESTED" } });
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 z-30 flex items-center gap-2 bg-brand-950 px-3 py-2 lg:h-dvh lg:flex-col lg:items-stretch lg:overflow-y-auto lg:p-4">
        <AdminNav badges={{ "/admin/fulfilment": toPack, "/admin/reviews": pendingReviews, "/admin/chat": openChats, "/admin/messages": unhandled + returns }} />
        <Link href="/admin" className="font-extrabold text-white lg:order-first lg:mb-6 lg:px-3">
          Courtline <span className="text-lime-accent">Admin</span>
        </Link>
        <div className="ml-auto text-xs text-white/60 lg:mt-auto lg:ml-0 lg:px-3 lg:pt-6">
          <p className="hidden truncate lg:block">{user.email}</p>
          <Link href="/" className="text-white/80 underline">View shop</Link>
        </div>
      </aside>
      <main id="main" className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
