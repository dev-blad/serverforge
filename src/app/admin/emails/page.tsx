import Link from "next/link";
import { db } from "@/lib/db";
import { features } from "@/lib/config";
import { formatDate } from "@/lib/utils";
import { PageHeader, Table } from "@/components/admin/ui";

export const metadata = { title: "Email outbox" };

export default async function EmailsPage() {
  const emails = await db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, to: true, subject: true, template: true, status: true, createdAt: true, error: true } });
  return (
    <div>
      <PageHeader title="Email outbox" description={features.email ? "Delivered via Resend. Every transactional email is logged here." : "RESEND_API_KEY not set — emails are logged here (STUBBED) instead of being sent."} />
      <div className="card p-2">
        <Table head={["Sent", "To", "Subject", "Template", "Status"]}>
          {emails.map((e) => (
            <tr key={e.id}>
              <td className="px-2 py-2 text-xs">{formatDate(e.createdAt, { dateStyle: "short", timeStyle: "short" })}</td>
              <td className="px-2 text-xs">{e.to}</td>
              <td className="px-2"><Link href={`/admin/emails/${e.id}`} className="hover:underline">{e.subject}</Link></td>
              <td className="px-2 text-xs">{e.template}</td>
              <td className={`px-2 text-xs font-semibold ${e.status === "FAILED" ? "text-sale" : e.status === "SENT" ? "text-brand-600" : "text-muted"}`} title={e.error ?? undefined}>{e.status}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
