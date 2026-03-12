import { NextRequest, NextResponse } from "next/server";
import { hash } from "@node-rs/argon2";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@foundation/db";

/**
 * GET /api/admin/users
 * List all users (excluding passwordHash), sorted by createdAt desc.
 */
export async function GET() {
  try {
    await requireAdmin();

    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        canRead: users.canRead,
        canWrite: users.canWrite,
        isAdmin: users.isAdmin,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Admin access required") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }
    console.error("List users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new user.
 * Body: { username, password, displayName?, role? }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { username, password, displayName, role } = body;

    // Validate required fields
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password is required and must be at least 6 characters" },
        { status: 400 }
      );
    }

    const normalizedUsername = username.toLowerCase().trim();
    const userRole = role || "viewer";

    // Determine permission flags based on role
    let isAdmin = false;
    let canWrite = false;
    let canRead = true;

    if (userRole === "admin") {
      isAdmin = true;
      canWrite = true;
      canRead = true;
    } else if (userRole === "write") {
      canWrite = true;
      canRead = true;
    } else {
      // viewer
      canRead = true;
    }

    // Hash the password
    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    // Insert user
    const [newUser] = await db
      .insert(users)
      .values({
        username: normalizedUsername,
        displayName: displayName || null,
        passwordHash,
        role: userRole,
        isAdmin,
        canWrite,
        canRead,
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        canRead: users.canRead,
        canWrite: users.canWrite,
        isAdmin: users.isAdmin,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Admin access required") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      // Handle unique constraint violation on username
      if (
        error.message.includes("unique") ||
        error.message.includes("duplicate") ||
        error.message.includes("23505")
      ) {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 409 }
        );
      }
    }
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
