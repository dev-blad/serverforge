"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NAV } from "./nav-data";

export function MegaMenu() {
  const [open, setOpen] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDoc = (e: MouseEvent) => navRef.current && !navRef.current.contains(e.target as Node) && setOpen(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, []);

  const enter = (i: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(i), 80);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(null), 150);
  };

  return (
    <nav ref={navRef} aria-label="Main" className="relative hidden lg:block" onMouseLeave={leave}>
      <ul className="flex items-center gap-1">
        {NAV.map((item, i) => (
          <li key={item.label} onMouseEnter={() => enter(i)}>
            <button
              type="button"
              aria-expanded={open === i}
              aria-controls={`mega-${i}`}
              onClick={() => setOpen(open === i ? null : i)}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-canvas ${open === i ? "bg-canvas" : ""}`}
            >
              {item.label}
              <ChevronDown className={`size-4 transition ${open === i ? "rotate-180" : ""}`} aria-hidden />
            </button>
          </li>
        ))}
        <li><Link href="/c/new" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-canvas">New in</Link></li>
        <li><Link href="/c/sale" className="rounded-lg px-3 py-2 text-sm font-semibold text-sale hover:bg-canvas">Sale</Link></li>
        <li><Link href="/find-a-game" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-canvas">Find a game</Link></li>
      </ul>
      {NAV.map((item, i) => (
        <div
          key={item.label}
          id={`mega-${i}`}
          hidden={open !== i}
          onMouseEnter={() => enter(i)}
          className="fixed inset-x-0 top-[var(--header-h,112px)] z-40 border-t border-line bg-white shadow-xl"
        >
          <div className="container-page grid grid-cols-4 gap-8 py-8">
            {item.columns.map((col) => (
              <div key={col.title}>
                <p className="mb-3 text-xs font-bold tracking-wider text-muted uppercase">{col.title}</p>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-sm hover:text-brand-600 hover:underline" onClick={() => setOpen(null)}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {item.promo && (
              <div className="col-start-4 rounded-xl bg-brand-900 p-5 text-white">
                <p className="text-lg font-bold text-lime-accent">{item.promo.title}</p>
                <p className="mt-1 text-sm text-white/80">{item.promo.text}</p>
                <Link href={item.promo.href} className="btn-accent btn-sm mt-4" onClick={() => setOpen(null)}>
                  {item.promo.cta}
                </Link>
              </div>
            )}
          </div>
        </div>
      ))}
    </nav>
  );
}
