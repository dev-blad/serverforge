"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Msg { id: string; author: string; body: string; createdAt: string }

/** Built-in live chat. Messages are relayed to the owner's WhatsApp (when configured) and the admin inbox. */
export function ChatWidget() {
  const provider = process.env.NEXT_PUBLIC_CHAT_PROVIDER ?? "internal";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [started, setStarted] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastAt = messages.at(-1)?.createdAt;

  const poll = useCallback(async () => {
    const res = await fetch(`/api/chat${lastAt ? `?after=${encodeURIComponent(lastAt)}` : ""}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { conversation: unknown; messages: Msg[] };
    if (data.conversation) setStarted(true);
    if (data.messages.length) setMessages((m) => [...m, ...data.messages.filter((x) => !m.some((y) => y.id === x.id))]);
  }, [lastAt]);

  useEffect(() => {
    if (!open) return;
    void poll();
    const t = setInterval(() => void poll(), 4000);
    return () => clearInterval(t);
  }, [open, poll]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (provider !== "internal" || pathname.startsWith("/checkout")) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, name: started ? undefined : name, email: started ? undefined : email, pageUrl: pathname }),
    });
    const data = (await res.json()) as { message?: Msg; error?: string };
    setSending(false);
    if (!res.ok || !data.message) return setError(data.error ?? "Couldn't send — please try again.");
    setMessages((m) => [...m, data.message!]);
    setStarted(true);
    setText("");
  };

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-brand-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-700" aria-label="Open live chat">
          <MessageCircle className="size-5" aria-hidden /> <span className="hidden sm:inline">Chat with us</span>
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Live chat" className="fixed inset-x-2 bottom-2 z-50 flex max-h-[80dvh] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
          <div className="flex items-center justify-between bg-brand-900 px-4 py-3 text-white">
            <div>
              <p className="font-semibold">Courtline support</p>
              <p className="text-xs text-white/75">Real padel players · usually reply within minutes (9am–7pm)</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full hover:bg-white/10" aria-label="Close chat">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-canvas p-4" aria-live="polite">
            <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3 text-sm shadow-sm">Hi! 👋 Questions about rackets, sizing or an order? Send us a message.</p>
            {messages.map((m) => (
              <p key={m.id} className={`max-w-[85%] rounded-2xl p-3 text-sm whitespace-pre-wrap shadow-sm ${m.author === "VISITOR" ? "ml-auto rounded-tr-sm bg-brand-900 text-white" : "rounded-tl-sm bg-white"}`}>
                <span className="sr-only">{m.author === "VISITOR" ? "You: " : "Courtline: "}</span>
                {m.body}
              </p>
            ))}
          </div>
          <form onSubmit={send} className="space-y-2 border-t border-line p-3">
            {!started && (
              <div className="grid grid-cols-2 gap-2">
                <label className="sr-only" htmlFor="chat-name">Your name</label>
                <input id="chat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="input py-2" autoComplete="name" />
                <label className="sr-only" htmlFor="chat-email">Email (optional)</label>
                <input id="chat-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="input py-2" autoComplete="email" />
              </div>
            )}
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="chat-text">Message</label>
              <textarea
                id="chat-text"
                ref={inputRef}
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Type a message…"
                className="input resize-none"
              />
              <button className="btn-primary px-3" disabled={sending || !text.trim()} aria-label="Send message">
                <Send className="size-4" aria-hidden />
              </button>
            </div>
            {error && <p role="alert" className="text-xs text-sale">{error}</p>}
            {!started && <p className="text-[11px] text-muted">By chatting you agree to our privacy policy. Chats are stored for 12 months.</p>}
          </form>
        </div>
      )}
    </>
  );
}
