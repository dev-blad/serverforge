import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader, Table } from "@/components/admin/ui";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { orders: { where: { status: { in: ["PAID", "PACKED", "SHIPPED", "DELIVERED"] } }, select: { total: true, createdAt: true } } },
  });
  const subscribers = await db.newsletterSubscriber.count();
  return (
    <div>
      <PageHeader title="Customers" description={`${users.length} accounts shown · ${subscribers} newsletter subscribers · guest buyers appear on orders only`} actions={<a href="/api/admin/export?type=subscribers" className="btn-outline btn-sm">Export subscribers CSV</a>} />
      <form className="mb-4 flex gap-2"><label htmlFor="cq" className="sr-only">Search customers</label><input id="cq" name="q" defaultValue={q} className="input max-w-xs" placeholder="Name or email" /><button className="btn-outline btn-sm">Search</button></form>
      <div className="card p-2">
        <Table head={["Customer", "Joined", "Orders", "Lifetime spend", "Last order", "Marketing", "Role"]}>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-2 py-2">{u.name ?? "—"}<br /><span className="text-xs text-muted">{u.email}</span></td>
              <td className="px-2 text-xs">{formatDate(u.createdAt)}</td>
              <td className="px-2">{u.orders.length}</td>
              <td className="px-2 font-semibold">{formatPrice(u.orders.reduce((s, o) => s + o.total, 0))}</td>
              <td className="px-2 text-xs">{u.orders.length ? formatDate(u.orders.reduce((a, o) => (o.createdAt > a ? o.createdAt : a), u.orders[0]!.createdAt)) : "—"}</td>
              <td className="px-2 text-xs">{u.marketingOptIn ? "opted in" : "—"}</td>
              <td className="px-2 text-xs">{u.role.toLowerCase()}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
