import type { Metadata } from "next";
import { WishlistView } from "./wishlist-view";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-extrabold">Your wishlist</h1>
      <WishlistView />
    </div>
  );
}
