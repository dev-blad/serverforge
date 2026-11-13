import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import type { Provider } from "next-auth/providers";
import { db } from "@/lib/db";
import { adminEmails } from "@/lib/config";
import { sendEmail } from "@/lib/email/send";
import { magicLinkEmail } from "@/lib/email/templates";
import { verifyCredentials } from "@/lib/credentials";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "CUSTOMER" | "ADMIN" } & DefaultSession["user"];
  }
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
