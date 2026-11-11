import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { replyToChat, setChatStatus } from "@/app/actions/admin-support";
import { PageHeader } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/admin/auto-refresh";

export default async function ChatThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.chatConversation.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <AutoRefresh seconds={5} />
      <PageHeader
        title={`${c.name ?? "Visitor"} · #${c.code}`}
        description={`${c.email ?? "no email"} · started on ${c.pageUrl ?? "site"} · ${formatDate(c.createdAt, { dateStyle: "medium", timeStyle: "short" })}`}
        actions={
          <>
            <Link href="/admin/chat" className="btn-outline btn-sm">← Inbox</Link>
            <form action={setChatStatus}><input type="hidden" name="conversationId" value={c.id} /><input type="hidden" name="status" value={c.status === "OPEN" ? "CLOSED" : "OPEN"} /><button className="btn-outline btn-sm">{c.status === "OPEN" ? "Close chat" : "Reopen"}</button></form>
          </>
        }
      />
      <div className="card space-y-2 bg-canvas p-4">
        {c.messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${m.author === "AGENT" ? "ml-auto bg-brand-900 text-white" : "bg-white"}`}>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className={`mt-1 text-[10px] ${m.author === "AGENT" ? "text-white/60" : "text-muted"}`}>{formatDate(m.createdAt, { timeStyle: "short", dateStyle: "short" })}{m.externalId ? " · sent to WhatsApp" : ""}</p>
          </div>
        ))}
      </div>
      <form action={replyToChat} className="sticky bottom-0 mt-3 flex gap-2 bg-canvas py-3">
        <input type="hidden" name="conversationId" value={c.id} />
        <label htmlFor="reply" className="sr-only">Reply</label>
        <input id="reply" name="body" required autoComplete="off" placeholder="Type your reply…" className="input" />
        <button className="btn-primary">Send</button>
      </form>
    </div>
  );
}
