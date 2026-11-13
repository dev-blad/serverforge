import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { PageViewTracker } from "@/components/layout/page-view-tracker";
import { ChatWidget } from "@/components/chat/chat-widget";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
      <CartDrawer />
      <ChatWidget />
      <PageViewTracker />
    </>
  );
}
