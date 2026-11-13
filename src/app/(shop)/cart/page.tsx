import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Your basket", description: "Review your basket, apply discount codes and check out securely with free UK delivery over £50." };

export default function CartPage() {
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-extrabold">Your basket</h1>
      <div className="min-h-[34rem]">
        <CartView />
      </div>
    </div>
  );
}
