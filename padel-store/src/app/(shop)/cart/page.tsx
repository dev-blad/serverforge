import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Your basket", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-extrabold">Your basket</h1>
      <CartView />
    </div>
  );
}
