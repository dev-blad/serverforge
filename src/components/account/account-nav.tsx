"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/account", "Overview"],
  ["/account/orders", "Orders"],
  ["/account/addresses", "Addresses"],
  ["/account/payment-methods", "Payment methods"],
  ["/wishlist", "Wishlist"],
  ["/account/settings", "Settings & privacy"],
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map(([href, label]) => {
        const active = href === "/account" ? path === href : path.startsWith(href!);
        return (
          <Link key={href} href={href!} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-900 text-white" : "hover:bg-canvas"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
