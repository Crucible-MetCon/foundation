import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * POST /api/pmx/bulk-update-trade-numbers
 *
 * Bulk-updates the order_id (Trade #) for trades matched by doc_number.
 * Body: { mappings: [{ docNumber: string, orderId: string }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mappings: { docNumber: string; orderId: string }[] = body.mappings;

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json(
        { ok: false, error: "mappings array is required" },
        { status: 400 },
      );
    }

    let updated = 0;
    let notFound = 0;
    const errors: string[] = [];

    for (const { docNumber, orderId } of mappings) {
      if (!docNumber) continue;

      // Normalize orderId
      let normalizedOrderId: string | null = null;
      if (orderId && String(orderId).trim()) {
        normalizedOrderId = String(orderId).trim().toUpperCase();
        if (normalizedOrderId.endsWith(".0")) {
          normalizedOrderId = normalizedOrderId.slice(0, -2);
        }
      }

      try {
        const result = await (db as any).execute(sql`
          UPDATE pmx_trades
          SET order_id = ${normalizedOrderId}
          WHERE doc_number = ${docNumber}
        `);

        // Check if any rows were affected
        const affected = (result as any)?.rowCount ?? (result as any)?.length ?? 0;
        if (affected > 0) {
          updated += affected;
        } else {
          // Verify the doc_number exists
          const check = await (db as any).execute(sql`
            SELECT id FROM pmx_trades WHERE doc_number = ${docNumber}
          `);
          if (!check || (check as any[]).length === 0) {
            notFound++;
          } else {
            // Row exists but already has the same value — count as updated
            updated++;
          }
        }
      } catch (err) {
        errors.push(`${docNumber}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      totalMappings: mappings.length,
      updated,
      notFound,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bulk update failed" },
      { status: 500 },
    );
  }
}
