'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FolderTree,
  Inbox,
  Mail,
  MessageCircle,
  Package,
  Percent,
  Settings,
  Star,
  Truck,
  Users,
  Map,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

const LINKS = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { href: '/admin/fulfilment', label: 'Fulfilment', icon: Truck },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/stock', label: 'Stock', icon: Boxes },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree },
  { href: '/admin/discounts', label: 'Discounts & gift cards', icon: Percent },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/chat', label: 'Live chat', icon: MessageCircle },
  { href: '/admin/messages', label: 'Contact & returns', icon: Inbox },
  { href: '/admin/community', label: 'Community', icon: Map },
  { href: '/admin/emails', label: 'Email outbox', icon: Mail },
  { href: '/admin/settings', label: 'Integrations', icon: Settings },
];

export function AdminNav({ badges }: { badges: Record<string, number> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const list = (
    <ul className="space-y-0.5">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === '/admin' ? path === href : path.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${active ? 'bg-white/10 font-semibold text-white' : 'text-white/75 hover:bg-white/5 hover:text-white'}`}
            >
              <Icon className="size-4" aria-hidden />
              <span className="flex-1">{label}</span>
              {badges[href] ? (
                <span className="rounded-full bg-lime-strong px-1.5 text-[11px] font-bold text-brand-950">
                  {badges[href]}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <>
      <button
        type="button"
        className="grid size-10 place-items-center text-white lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        aria-expanded={open}
      >
        <Menu className="size-6" aria-hidden />
      </button>
      <nav aria-label="Admin" className="hidden lg:block">
        {list}
      </nav>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <nav
              aria-label="Admin"
              className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-brand-950 p-4"
            >
              <button
                type="button"
                className="mb-4 ml-auto grid size-9 place-items-center text-white"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </button>
              {list}
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
