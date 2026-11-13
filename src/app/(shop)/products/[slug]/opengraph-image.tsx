import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const alt = "Product image";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProductOg({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db.product.findUnique({ where: { slug }, select: { name: true, price: true, shortDescription: true, brand: { select: { name: true } } } });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0d3b2e,#176345)", color: "white" }}>
        <div style={{ fontSize: 30, color: "#d9f99d", fontWeight: 700 }}>Courtline Padel</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, opacity: 0.8 }}>{p?.brand?.name ?? ""}</div>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>{p?.name ?? "Padel kit"}</div>
          <div style={{ fontSize: 28, marginTop: 16, opacity: 0.85, maxWidth: 1000 }}>{p?.shortDescription ?? ""}</div>
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color: "#a3e635" }}>£{((p?.price ?? 0) / 100).toFixed(2)}</div>
      </div>
    ),
    size,
  );
}
