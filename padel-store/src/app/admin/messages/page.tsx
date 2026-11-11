import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { markContactHandled, setReturnStatus } from "@/app/actions/admin-support";
import { PageHeader, Panel } from "@/components/admin/ui";

export const metadata = { title: "Contact & returns" };

export default async function MessagesPage() {
  const [messages, returns] = await Promise.all([
    db.contactMessage.findMany({ orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 100 }),
    db.returnRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Contact & returns" />
      <Panel title="Return requests">
        {returns.length === 0 && <p className="text-sm text-muted">No return requests.</p>}
        <ul className="divide-y divide-line">
          {returns.map((r) => (
            <li key={r.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p><strong>{r.orderNumber.toUpperCase()}</strong> · {r.email} · {r.reason} → {r.resolution} <span className="text-xs text-muted">· {formatDate(r.createdAt)} · ref {r.id.slice(-8).toUpperCase()}</span></p>
                <form action={setReturnStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="sr-only" htmlFor={`rs-${r.id}`}>Status</label>
                  <select id={`rs-${r.id}`} name="status" defaultValue={r.status} className="input w-auto py-1 text-xs">
                    {["REQUESTED", "REVIEW", "LABEL_SENT", "RECEIVED", "REFUNDED", "REJECTED"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button className="btn-outline btn-sm">Update</button>
                </form>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{r.items}</p>
              {r.comments && <p className="mt-1 text-muted">{r.comments}</p>}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Contact form">
        <ul className="divide-y divide-line">
          {messages.map((m) => (
            <li key={m.id} className={`py-3 text-sm ${m.handled ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p><strong>{m.subject}</strong> — {m.name} &lt;<a className="underline" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}>{m.email}</a>&gt; {m.orderNumber && `· ${m.orderNumber}`} <span className="text-xs text-muted">· {formatDate(m.createdAt)}</span></p>
                {!m.handled && <form action={markContactHandled}><input type="hidden" name="id" value={m.id} /><button className="btn-outline btn-sm">Mark handled</button></form>}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
