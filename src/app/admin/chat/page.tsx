import Link from "next/link";
import { db } from "@/lib/db";
import { features } from "@/lib/config";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Live chat" };

export default async function ChatInbox() {
  const convs = await db.chatConversation.findMany({
    where: { messages: { some: {} } },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return (
    <div>
      <PageHeader title="Live chat" description={features.whatsapp ? "Chats are relayed to your WhatsApp — reply there or here." : "WhatsApp relay not configured — reply here (works on your phone too)."} />
      <ul className="card divide-y divide-line">
        {convs.length === 0 && <li className="p-6 text-sm text-muted">No chats yet.</li>}
        {convs.map((c) => {
          const last = c.messages[0];
          const awaiting = last?.author === "VISITOR" && c.status === "OPEN";
          return (
            <li key={c.id}>
              <Link href={`/admin/chat/${c.id}`} className="flex items-start gap-3 p-4 hover:bg-canvas">
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${awaiting ? "bg-lime-strong" : "bg-line"}`} aria-hidden />
                {awaiting && <span className="sr-only">Awaiting reply:</span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.name ?? "Visitor"} <span className="text-xs font-normal text-muted">#{c.code} {c.email} · {c.status.toLowerCase()}</span></p>
                  <p className="truncate text-sm text-muted">{last?.author === "AGENT" ? "You: " : ""}{last?.body}</p>
                </div>
                <span className="text-xs text-muted">{formatDate(c.lastMessageAt, { dateStyle: "short", timeStyle: "short" })}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
