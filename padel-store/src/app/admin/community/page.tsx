import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { setListingStatus } from "@/app/actions/admin-support";
import { PageHeader, Table } from "@/components/admin/ui";

export const metadata = { title: "Community" };

export default async function CommunityAdmin() {
  const [listings, venues] = await Promise.all([
    db.gameListing.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { email: true } } } }),
    db.venue.count(),
  ]);
  return (
    <div>
      <PageHeader title="Community board" description={`${listings.length} listings · ${venues} venues in the court finder (edit venues via the seed file or database)`} />
      <div className="card p-2">
        <Table head={["Listing", "When", "Posted by", "Status", ""]}>
          {listings.map((l) => (
            <tr key={l.id}>
              <td className="px-2 py-2"><strong>{l.title}</strong><br /><span className="text-xs text-muted">{l.city} · {l.level} · contact: {l.contact}</span></td>
              <td className="px-2 text-xs">{formatDate(l.playDate, { dateStyle: "short", timeStyle: "short" })}</td>
              <td className="px-2 text-xs">{l.user.email}</td>
              <td className="px-2 text-xs">{l.status.toLowerCase()}</td>
              <td className="px-2">
                <form action={setListingStatus}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="status" value={l.status === "REMOVED" ? "OPEN" : "REMOVED"} />
                  <button className="text-xs text-sale underline">{l.status === "REMOVED" ? "Restore" : "Remove"}</button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
