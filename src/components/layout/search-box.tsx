"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatPrice } from "@/lib/money";

interface Result {
  products: { slug: string; name: string; price: number; image?: string; brand?: string }[];
  categories: { slug: string; name: string }[];
}

export function SearchBox({ className, autoFocus = false, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setRes((await r.json()) as Result);
        setOpen(true);
        setActive(-1);
      } catch {
        /* aborted */
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = [
    ...(res?.categories ?? []).map((c) => ({ key: `c-${c.slug}`, href: `/c/${c.slug}`, label: c.name })),
    ...(res?.products ?? []).map((p) => ({ key: `p-${p.slug}`, href: `/products/${p.slug}`, label: p.name })),
  ];

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    onNavigate?.();
    router.push(href);
  };

  return (
    <div ref={boxRef} className={`relative ${className ?? ""}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && options[active]) go(options[active].href);
          else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          Search products
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id={`${id}-input`}
            type="search"
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder="Search rackets, balls, brands…"
            className="input rounded-full bg-canvas pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => res && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(options.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(-1, a - 1));
              } else if (e.key === "Escape") setOpen(false);
            }}
          />
        </div>
      </form>
      {open && res && (
        <div id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          {options.length === 0 ? (
            <p className="p-4 text-sm text-muted">No matches for “{q}”.</p>
          ) : (
            <ul>
              {res.categories.map((c, i) => (
                <li key={c.slug} id={`${id}-opt-${i}`} role="option" aria-selected={active === i}>
                  <button type="button" onClick={() => go(`/c/${c.slug}`)} className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${active === i ? "bg-canvas" : ""}`}>
                    <span className="text-muted">Category:</span> <strong>{c.name}</strong>
                  </button>
                </li>
              ))}
              {res.products.map((p, j) => {
                const i = j + res.categories.length;
                return (
                  <li key={p.slug} id={`${id}-opt-${i}`} role="option" aria-selected={active === i}>
                    <button type="button" onClick={() => go(`/products/${p.slug}`)} className={`flex w-full items-center gap-3 px-4 py-2 text-left ${active === i ? "bg-canvas" : "hover:bg-canvas"}`}>
                      {p.image && <Image src={p.image} alt="" width={40} height={40} className="rounded-md" unoptimized />}
                      <span className="flex-1 text-sm">
                        <span className="block font-medium">{p.name}</span>
                        <span className="text-xs text-muted">{p.brand}</span>
                      </span>
                      <span className="text-sm font-semibold">{formatPrice(p.price)}</span>
                    </button>
                  </li>
                );
              })}
              <li>
                <button type="button" onClick={() => go(`/search?q=${encodeURIComponent(q)}`)} className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-canvas">
                  See all results for “{q}”
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
