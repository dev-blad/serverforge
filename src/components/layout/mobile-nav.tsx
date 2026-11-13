'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NAV } from './nav-data';
import { SearchBox } from './search-box';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-lg hover:bg-canvas lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="size-6" aria-hidden />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-white"
            >
              <div className="flex items-center justify-between border-b border-line p-4">
                <span className="font-bold">Menu</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  className="grid size-9 place-items-center"
                  aria-label="Close menu"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="p-4">
                <SearchBox onNavigate={close} />
              </div>
              <nav aria-label="Mobile" className="px-2 pb-6">
                {NAV.map((item) => (
                  <details key={item.label} className="group border-b border-line">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-3 font-semibold">
                      {item.label}
                      <span className="text-muted group-open:rotate-45 transition" aria-hidden>
                        +
                      </span>
                    </summary>
                    <ul className="pb-3">
                      <li>
                        <Link
                          href={item.href}
                          onClick={close}
                          className="block px-4 py-2 text-sm font-semibold text-brand-700"
                        >
                          Shop all {item.label.toLowerCase()}
                        </Link>
                      </li>
                      {item.columns
                        .flatMap((c) => c.links)
                        .map((l) => (
                          <li key={l.href}>
                            <Link href={l.href} onClick={close} className="block px-4 py-2 text-sm">
                              {l.label}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </details>
                ))}
                {[
                  ['New in', '/c/new'],
                  ['Sale', '/c/sale'],
                  ['Racket finder', '/racket-finder'],
                  ['Find a game', '/find-a-game'],
                  ['Track my order', '/track'],
                  ['Help & FAQs', '/help'],
                  ['My account', '/account'],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href!}
                    onClick={close}
                    className="block border-b border-line px-2 py-3 font-semibold"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>,
          // Portal to <body>: the sticky header uses backdrop-filter, which would otherwise
          // trap this fixed overlay inside the header's box and stacking context.
          document.body,
        )}
    </>
  );
}
