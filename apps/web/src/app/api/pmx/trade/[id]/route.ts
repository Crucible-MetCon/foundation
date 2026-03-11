import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tradeId = parseInt(id, 10);
    if (isNaN(tradeId)) {
      return NextResponse.json({ ok: false, error: "Invalid trade ID" }, { status: 400 });
    }

    const body = await request.json();
    const orderId = body.orderId;

    if (orderId === undefined) {
      return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 });
    }

    // Normalize trade number
    let normalizedOrderId: string | null = null;
    if (orderId && String(orderId).trim()) {
      normalizedOrderId = String(orderId).trim().toUpperCase();
      if (normalizedOrderId.endsWith(".0")) {
        normalizedOrderId = normalizedOrderId.slice(0, -2);
      }
    }

    const result = await (db as any).execute(sql`
      UPDATE pmx_trades
      SET order_id = ${normalizedOrderId}
      WHERE id = ${tradeId}
    `);

    // Check if row was found
    const check = await (db as any).execute(sql`
      SELECT id FROM pmx_trades WHERE id = ${tradeId}
    `);

    if (!check || (check as any[]).length === 0) {
      return NextResponse.json({ ok: false, error: "Trade not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, tradeId, orderId: normalizedOrderId });
  } catch (error) {
    console.error("Update trade error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
