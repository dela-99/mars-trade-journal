import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders } from "better-auth/node";
import {
  db,
  usersTable,
  sessionsTable,
  accountsTable,
  verificationsTable,
  rateLimitsTable,
} from "../db/index";
import type { RequestHandler } from "express";

// No fallback secret: production and local installations must configure their own.
if (
  !process.env.BETTER_AUTH_SECRET ||
  process.env.BETTER_AUTH_SECRET.length < 32
)
  throw new Error(
    "Set BETTER_AUTH_SECRET to a random secret of at least 32 characters.",
  );
if (!process.env.BETTER_AUTH_URL)
  throw new Error("Set BETTER_AUTH_URL to the public application origin.");
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.BETTER_AUTH_URL],
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: usersTable,
      session: sessionsTable,
      account: accountsTable,
      verification: verificationsTable,
      rateLimit: rateLimitsTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
});

export const requireUser: RequestHandler = async (req, res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    res.status(401).json({ error: "Sign in to access your journal." });
    return;
  }
  // All writes require a same-origin browser request, including session-authenticated imports.
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  ) {
    res
      .status(403)
      .json({ error: "This request must come from the journal application." });
    return;
  }
  res.locals.userId = session.user.id;
  next();
};
