import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Provider } from "next-auth/providers";
import { db } from "@/lib/db";
import { adminEmails } from "@/lib/config";
import { sendEmail } from "@/lib/email/send";
import { magicLinkEmail } from "@/lib/email/templates";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "CUSTOMER" | "ADMIN" } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1).max(200),
});

/** Verify an email/password pair. Exported for tests. */
export async function verifyCredentials(raw: unknown) {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash) return null;
  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
}

const providers: Provider[] = [
  Credentials({
    name: "Email and password",
    credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
    authorize: verifyCredentials,
  }),
  Resend({
    id: "email",
    name: "Email link",
    apiKey: process.env.RESEND_API_KEY ?? "not-configured",
    from: process.env.EMAIL_FROM ?? "Courtline Padel <orders@courtline.example>",
    async sendVerificationRequest({ identifier, url }) {
      const { subject, html } = magicLinkEmail(url);
      await sendEmail({ to: identifier, subject, html, template: "magic-link" });
      if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
        console.info(`[auth] Magic link for ${identifier}: ${url}`);
      }
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ allowDangerousEmailAccountLinking: true }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/account/login", verifyRequest: "/account/login?check=email", error: "/account/login" },
  providers,
  events: {
    async createUser({ user }) {
      if (user.email && adminEmails().includes(user.email.toLowerCase())) {
        await db.user.update({ where: { id: user.id! }, data: { role: "ADMIN" } });
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { role: true, email: true } });
        let role = dbUser?.role ?? "CUSTOMER";
        if (role !== "ADMIN" && dbUser && adminEmails().includes(dbUser.email.toLowerCase())) {
          await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
          role = "ADMIN";
        }
        token.sub = user.id;
        token.role = role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = (token.role as "CUSTOMER" | "ADMIN") ?? "CUSTOMER";
      return session;
    },
  },
});
