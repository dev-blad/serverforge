import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Courtline Padel",
    short_name: "Courtline",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d3b2e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
