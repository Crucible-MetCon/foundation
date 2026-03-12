import { NextRequest, NextResponse } from "next/server";
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@foundation/db";

/**
 * PATCH /api/admin/users/[id]
 * Update a user's profile, role, active status, or password.
 * Body can contain: { displayName?, role?, isActive?, password? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const body = await request.json();
    const { displayName, role, isActive, password } = body;

    // Build the update object
    const updateData: Record<string, unknown> = {};

    if (displayName !== undefined) {
      updateData.displayName = displayName;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // If role changes, update permission flags accordingly
    if (role !== undefined) {
      updateData.role = role;

      if (role === "admin") {
        updateData.isAdmin = true;
        updateData.canWrite = true;
        updateData.canRead = true;
      } else if (role === "write") {
        updateData.isAdmin = false;
        updateData.canWrite = true;
        updateData.canRead = true;
      } else {
        // viewer
        updateData.isAdmin = false;
        updateData.canWrite = false;
        updateData.canRead = true;
      }
    }

    // If password provided, hash it
    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      updateData.passwordHash = await hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
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

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Admin access required") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Soft-delete (deactivate) a user by setting isActive = false.
 * Prevents self-deactivation.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Prevent self-deactivation
    if (admin.id === userId) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 }
      );
    }

    const [deactivated] = await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (!deactivated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Admin access required") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }
    console.error("Deactivate user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
