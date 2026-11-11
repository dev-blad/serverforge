import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";

export default async function EmailPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await db.emailLog.findUnique({ where: { id } });
  if (!e) notFound();
  return (
    <div>
      <PageHeader title={e.subject} description={`To ${e.to} · ${e.template} · ${e.status}`} actions={<Link href="/admin/emails" className="btn-outline btn-sm">← Outbox</Link>} />
      <iframe title="Email preview" srcDoc={e.html} sandbox="" className="h-[75vh] w-full rounded-xl border border-line bg-white" />
    </div>
  );
}
