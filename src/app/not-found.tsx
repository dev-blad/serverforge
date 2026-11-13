import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="container-page py-20 text-center">
        <p className="text-sm font-bold tracking-widest text-brand-600 uppercase">404 — out of court</p>
        <h1 className="mt-2 text-4xl font-extrabold">We can&apos;t find that page</h1>
        <p className="mt-3 text-muted">It may have moved, or the link might be out of date.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="btn-primary">Back to home</Link>
          <Link href="/c/rackets" className="btn-outline">Shop rackets</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
