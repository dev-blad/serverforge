import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1).max(200),
});

/** Verify an email/password pair (used by the Auth.js Credentials provider). */
export async function verifyCredentials(raw: unknown) {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash) {
    // Constant-ish time: still run a hash comparison to avoid user enumeration by timing.
    await bcrypt.compare(parsed.data.password, "$2a$10$CwTycUXWue0Thq9StjUM0uJ8DqHhvWQh2cW8D8x1b9Oe5fGvR2Gm6");
    return null;
  }
  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
}
