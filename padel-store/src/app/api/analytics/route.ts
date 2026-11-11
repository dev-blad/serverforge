import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent } from "@/lib/analytics";

const schema = z.object({
  type: z.enum(["page_view", "product_view"]),
  path: z.string().max(300).startsWith("/"),
  productId: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  if (parsed.data.path.startsWith("/admin")) return new NextResponse(null, { status: 204 });
  await trackEvent(req, parsed.data);
  return new NextResponse(null, { status: 204 });
}
