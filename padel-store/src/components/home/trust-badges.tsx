import { Truck, Clock, RotateCcw, Lock, MessageCircle } from "lucide-react";

const BADGES = [
  { icon: Truck, title: "Free UK delivery", text: "On orders over £50" },
  { icon: Clock, title: "Same-day dispatch", text: "Order by 2pm Mon–Fri" },
  { icon: RotateCcw, title: "30-day returns", text: "Hassle-free, UK based" },
  { icon: Lock, title: "Secure checkout", text: "Apple Pay, Google Pay, Link" },
  { icon: MessageCircle, title: "Expert advice", text: "Chat with real players" },
];

export function TrustBadges() {
  return (
    <section aria-label="Why shop with us" className="border-y border-line bg-canvas">
      <ul className="container-page grid grid-cols-2 gap-4 py-5 sm:grid-cols-3 lg:grid-cols-5">
        {BADGES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brand-700 ring-1 ring-line">
              <Icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
