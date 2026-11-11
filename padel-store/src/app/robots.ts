import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : true;
  return {
    rules: isProd
      ? [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/account/orders", "/account/addresses", "/account/payment-methods", "/account/settings", "/checkout", "/invoice", "/search", "/cart-recover"] }]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
