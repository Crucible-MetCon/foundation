import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * GET /api/my-tasks
 * Returns the count of active (non-completed) tasks assigned to the current user.
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const rows = await (db as any).execute(sql`
      SELECT COUNT(*)::int AS count
      FROM dev_tasks
      WHERE assigned_to = ${user.id}
        AND status != 'completed'
    `);

    const count = (rows as any[])?.[0]?.count ?? 0;

    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Table may not exist yet — return 0
    return NextResponse.json({ count: 0 });
  }
}
