import { NextRequest, NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { lucia } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@foundation/db";
import { loginSchema } from "@foundation/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      );
    }

    const validPassword = await verify(user.passwordHash, password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    if (!validPassword) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const session = await lucia.createSession(user.id as any, {});
    const cookie = lucia.createSessionCookie(session.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });

    response.cookies.set(cookie.name, cookie.value, cookie.attributes);
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
