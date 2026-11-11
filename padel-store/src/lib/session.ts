import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
}

export async function requireUser(callbackUrl = "/account") {
  const user = await currentUser();
  if (!user) redirect(`/account/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

/** Admin guard — always re-checks the role in the database (never trusts the JWT alone). */
export async function requireAdmin() {
  const user = await currentUser();
  if (!user) redirect("/account/login?callbackUrl=/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** For route handlers / server actions that must not redirect. */
export async function assertAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") throw new Error("Forbidden");
  return user;
}
