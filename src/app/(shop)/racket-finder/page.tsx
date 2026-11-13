import type { Metadata } from "next";
import { getProductsBy } from "@/lib/catalog";
import { RacketFinder } from "./racket-finder";

export const metadata: Metadata = {
  title: "Racket finder — which padel racket should I buy?",
  description: "Answer four quick questions about your level, style and arm comfort and we'll recommend the padel rackets that suit your game.",
};
export const revalidate = 600;

export default async function RacketFinderPage() {
  const rackets = await getProductsBy({ category: { slug: "rackets" } }, [{ salesCount: "desc" }], 50);
  const { db } = await import("@/lib/db");
  const attrs = await db.product.findMany({
    where: { category: { slug: "rackets" }, status: "ACTIVE" },
    select: { id: true, shape: true, skillLevel: true, balance: true, weightGrams: true, specs: true },
  });
  const enriched = rackets.map((r) => {
    const a = attrs.find((x) => x.id === r.id)!;
    const feel = ((a.specs as { label: string; value: string }[]).find((s) => s.label === "Feel")?.value ?? "").toLowerCase();
    return { ...r, shape: a.shape, level: a.skillLevel, balance: a.balance, weight: a.weightGrams, soft: feel.includes("soft") };
  });
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Racket finder</h1>
      <p className="mt-2 max-w-2xl text-muted">Four quick questions and we&apos;ll match you with the rackets in our range that suit your game best.</p>
      <RacketFinder rackets={enriched} />
    </div>
  );
}
