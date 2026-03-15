import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Auto-create table on first access
let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  await (db as any).execute(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Seed defaults
  await (db as any).execute(sql`
    INSERT INTO app_settings (key, value)
    VALUES ('hurdle_rate_pct', '0.2')
    ON CONFLICT (key) DO NOTHING
  `);
  tableEnsured = true;
}

/**
 * GET /api/settings
 * Returns all global settings as a key-value map.
 */
export async function GET() {
  try {
    await requireAuth();
    await ensureTable();

    const rows = await (db as any).execute(sql`
      SELECT key, value FROM app_settings
    `);

    const settings: Record<string, string> = {};
    for (const row of rows as any[]) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Upsert a single setting. Admin only.
 * Body: { key: string, value: string }
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    await ensureTable();

    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }
    if (value === undefined || value === null) {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
    }

    await (db as any).execute(sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${key}, ${String(value)}, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = ${String(value)}, updated_at = NOW()
    `);

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
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
