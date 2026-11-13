import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { verifyCredentials } from "@/lib/credentials";
import { registerUser } from "@/app/actions/auth";

afterAll(() => db.$disconnect());

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("auth", () => {
  it("registers a user with a hashed password and links prior guest orders", async () => {
    await db.order.create({ data: { email: "newbie@example.com", subtotal: 100, total: 100, shippingMethod: "x", shippingAddress: {} } });
    const res = await registerUser(null, fd({ name: "New Player", email: "Newbie@Example.com", password: "CourtTest2026x" }));
    expect(res?.ok).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { email: "newbie@example.com" }, include: { orders: true } });
    expect(user.passwordHash).not.toContain("CourtTest2026x");
    expect(user.orders).toHaveLength(1);
  });

  it("rejects weak passwords and duplicate accounts", async () => {
    expect((await registerUser(null, fd({ name: "A B", email: "weak@example.com", password: "short" })))?.ok).toBe(false);
    expect((await registerUser(null, fd({ name: "A B", email: "newbie@example.com", password: "CourtTest2026x" })))?.message).toMatch(/already exists/);
  });

  it("verifies credentials case-insensitively and rejects wrong passwords", async () => {
    expect(await verifyCredentials({ email: "NEWBIE@example.com", password: "CourtTest2026x" })).toMatchObject({ email: "newbie@example.com", role: "CUSTOMER" });
    expect(await verifyCredentials({ email: "newbie@example.com", password: "wrong" })).toBeNull();
    expect(await verifyCredentials({ email: "nobody@example.com", password: "whatever" })).toBeNull();
    expect(await verifyCredentials({ email: "not-an-email", password: "x" })).toBeNull();
  });

  it("grants ADMIN to emails listed in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    await registerUser(null, fd({ name: "The Boss", email: "boss@example.com", password: "CourtTest2026x" }));
    expect((await db.user.findUniqueOrThrow({ where: { email: "boss@example.com" } })).role).toBe("ADMIN");
  });
});
