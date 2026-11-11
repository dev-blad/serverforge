import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** UK GDPR subject access: export the signed-in user's personal data as JSON. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true, email: true, createdAt: true, marketingOptIn: true,
      addresses: true,
      orders: { include: { items: true } },
      reviews: true,
      wishlistItems: { include: { product: { select: { name: true } } } },
      gameListings: true,
    },
  });
  return new NextResponse(JSON.stringify(user, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="courtline-my-data.json"' },
  });
}
