import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { devTasks, users } from "@foundation/db";
import { sql } from "drizzle-orm";

// Auto-create table on first access (safe: IF NOT EXISTS)
let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  await (db as any).execute(sql`
    CREATE TABLE IF NOT EXISTS dev_tasks (
      id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'enhancement',
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_by INTEGER NOT NULL REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);
  await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS dev_tasks_status_idx ON dev_tasks(status)`);
  await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS dev_tasks_type_idx ON dev_tasks(type)`);
  await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS dev_tasks_created_by_idx ON dev_tasks(created_by)`);
  tableEnsured = true;
}

/**
 * GET /api/admin/tasks
 * List all dev tasks with creator and assignee display names.
 */
export async function GET() {
  try {
    await requireAdmin();
    await ensureTable();

    const rows = await (db as any).execute(sql`
      SELECT
        t.id,
        t.title,
        t.description,
        t.type,
        t.status,
        t.priority,
        t.created_by,
        t.assigned_to,
        t.created_at,
        t.updated_at,
        t.completed_at,
        uc.display_name AS creator_name,
        ua.display_name AS assignee_name
      FROM dev_tasks t
      LEFT JOIN users uc ON uc.id = t.created_by
      LEFT JOIN users ua ON ua.id = t.assigned_to
      ORDER BY t.created_at DESC
    `);

    const tasks = (rows as any[]).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      status: r.status,
      priority: r.priority,
      createdBy: r.created_by,
      assignedTo: r.assigned_to,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
      creatorName: r.creator_name || "Unknown",
      assigneeName: r.assignee_name || null,
    }));

    return NextResponse.json({ tasks });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Admin access required") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }
    console.error("List tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/tasks
 * Create a new dev task.
 * Body: { title, description?, type?, priority?, assignedTo? }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    await ensureTable();
    const body = await request.json();
    const { title, description, type, priority, assignedTo } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    const validTypes = ["bug", "enhancement"];
    const validPriorities = ["low", "medium", "high", "critical"];

    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Priority must be one of: ${validPriorities.join(", ")}` },
        { status: 400 },
      );
    }

    const [newTask] = await db
      .insert(devTasks)
      .values({
        title: title.trim(),
        description: description?.trim() || null,
        type: type || "enhancement",
        priority: priority || "medium",
        createdBy: admin.id,
        assignedTo: assignedTo || null,
      })
      .returning();

    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Admin access required") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }
    console.error("Create task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
