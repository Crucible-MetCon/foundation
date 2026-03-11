import { NextResponse } from "next/server";
import { lucia, getUser } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;

  if (sessionId) {
    await lucia.invalidateSession(sessionId);
  }

  const cookie = lucia.createBlankSessionCookie();
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookie.name, cookie.value, cookie.attributes);
  return response;
}
