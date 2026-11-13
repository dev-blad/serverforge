import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { sendAbandonedCartEmails } from "@/lib/abandoned-cart";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await sendAbandonedCartEmails());
}
