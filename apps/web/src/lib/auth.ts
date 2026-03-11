import { Lucia } from "lucia";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { db } from "./db";
import { sessions, users } from "@foundation/db";
import { cookies } from "next/headers";
import { cache } from "react";

// Lucia adapter - the `as any` is needed because our userId is integer
// but Lucia's type expects string. Runtime works correctly with integers.
const adapter = new DrizzlePostgreSQLAdapter(
  db as any,
  sessions as any,
  users as any
);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
      displayName: attributes.displayName,
      role: attributes.role,
      canRead: attributes.canRead,
      canWrite: attributes.canWrite,
      isAdmin: attributes.isAdmin,
      isActive: attributes.isActive,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    UserId: number;
    DatabaseUserAttributes: {
      username: string;
      displayName: string | null;
      role: string;
      canRead: boolean;
      canWrite: boolean;
      isAdmin: boolean;
      isActive: boolean;
    };
  }
}

export const getUser = cache(async () => {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) return null;

  const result = await lucia.validateSession(sessionId);
  if (!result.session) {
    const cookie = lucia.createBlankSessionCookie();
    cookieStore.set(cookie.name, cookie.value, cookie.attributes);
    return null;
  }

  if (result.session.fresh) {
    const cookie = lucia.createSessionCookie(result.session.id);
    cookieStore.set(cookie.name, cookie.value, cookie.attributes);
  }

  if (!result.user.isActive) return null;

  return result.user;
});

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!user.isAdmin) {
    throw new Error("Admin access required");
  }
  return user;
}
