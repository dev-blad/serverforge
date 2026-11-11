import { ImageResponse } from "next/og";

export const alt = "Courtline Padel — padel rackets, balls & kit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0d3b2e", color: "white" }}>
        <div style={{ fontSize: 34, color: "#d9f99d", fontWeight: 700 }}>Courtline Padel</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 20 }}>Kit that wins the point.</div>
        <div style={{ fontSize: 32, marginTop: 24, color: "rgba(255,255,255,0.8)" }}>Padel rackets & balls · Free UK delivery over £50</div>
      </div>
    ),
    size,
  );
}
