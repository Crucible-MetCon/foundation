import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { users, sessions } from "@foundation/db";

/**
 * One-time database setup endpoint.
 * Creates all tables and seeds the admin user.
 * GET /api/setup
 */
export async function GET() {
  try {
    // Create tables using raw SQL (Drizzle push equivalent)
    await (db as any).execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        can_read BOOLEAN NOT NULL DEFAULT true,
        can_write BOOLEAN NOT NULL DEFAULT false,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await (db as any).execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);

    await (db as any).execute(sql`
      CREATE TABLE IF NOT EXISTS pmx_trades (
        id SERIAL PRIMARY KEY,
        doc_number TEXT UNIQUE,
        trade_date TIMESTAMP,
        value_date TIMESTAMP,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity NUMERIC(18,8) NOT NULL,
        price NUMERIC(18,8) NOT NULL,
        narration TEXT,
        settle_currency TEXT,
        settle_amount NUMERIC(18,4),
        order_id TEXT,
        clord_id TEXT,
        fnc_number TEXT,
        trader_name TEXT,
        source_system TEXT,
        rest_trade_id TEXT,
        fix_trade_id TEXT,
        raw_payload JSONB,
        synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await (db as any).execute(sql`
      CREATE TABLE IF NOT EXISTS trademc_companies (
        id SERIAL PRIMARY KEY,
        directus_id INTEGER UNIQUE NOT NULL,
        company_name TEXT NOT NULL,
        status TEXT,
        registration_number TEXT,
        contact_number TEXT,
        email_address TEXT,
        trade_limit NUMERIC(18,4),
        blocked BOOLEAN DEFAULT false,
        vat_number TEXT,
        evo_customer_code TEXT,
        refining_rate NUMERIC(8,4),
        synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await (db as any).execute(sql`
      CREATE TABLE IF NOT EXISTS trademc_trades (
        id SERIAL PRIMARY KEY,
        directus_id INTEGER UNIQUE NOT NULL,
        status TEXT,
        company_id INTEGER,
        weight NUMERIC(18,8),
        notes TEXT,
        ref_number TEXT,
        trade_timestamp TIMESTAMPTZ,
        zar_per_troy_ounce NUMERIC(18,6),
        zar_to_usd NUMERIC(18,8),
        requested_zar_per_gram NUMERIC(18,6),
        zar_per_troy_ounce_confirmed NUMERIC(18,6),
        zar_to_usd_confirmed NUMERIC(18,8),
        usd_per_troy_ounce_confirmed NUMERIC(18,6),
        evo_exported BOOLEAN DEFAULT false,
        synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await (db as any).execute(sql`
      CREATE TABLE IF NOT EXISTS trademc_weight_transactions (
        id SERIAL PRIMARY KEY,
        directus_id INTEGER UNIQUE NOT NULL,
        company_id INTEGER,
        trade_id INTEGER,
        type TEXT NOT NULL,
        weight NUMERIC(18,8),
        gold_percentage NUMERIC(8,4),
        rolling_balance NUMERIC(18,8),
        notes TEXT,
        pc_code TEXT,
        transaction_timestamp TIMESTAMPTZ,
        synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await (db as any).execute(sql`
      CREATE TABLE IF NOT EXISTS account_opening_balances (
        id SERIAL PRIMARY KEY,
        month TEXT NOT NULL,
        currency TEXT NOT NULL,
        opening_balance NUMERIC(18,6) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(month, currency)
      )
    `);

    await (db as any).execute(sql`
      CREATE TABLE IF NOT EXISTS sync_jobs (
        id SERIAL PRIMARY KEY,
        job_name TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        result JSONB,
        error TEXT
      )
    `);

    // Create indexes
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_pmx_trade_date ON pmx_trades(trade_date)`);
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_pmx_symbol ON pmx_trades(symbol)`);
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_pmx_order_id ON pmx_trades(order_id)`);
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_pmx_fnc_number ON pmx_trades(fnc_number)`);
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_pmx_doc_number ON pmx_trades(doc_number)`);
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_tmc_company_name ON trademc_companies(company_name)`);
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_tmc_company ON trademc_trades(company_id)`);
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_tmc_ref_number ON trademc_trades(ref_number)`);
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_tmc_status ON trademc_trades(status)`);
    await (db as any).execute(sql`CREATE INDEX IF NOT EXISTS idx_tmc_timestamp ON trademc_trades(trade_timestamp)`);

    // Seed admin user (if not exists)
    const existingAdmin = await (db as any).execute(
      sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`
    );

    let adminSeeded = false;
    if (existingAdmin.length === 0) {
      const passwordHash = await hash("admin", {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      await (db as any).execute(sql`
        INSERT INTO users (username, display_name, password_hash, role, can_read, can_write, is_admin, is_active)
        VALUES ('admin', 'Administrator', ${passwordHash}, 'admin', true, true, true, true)
      `);
      adminSeeded = true;
    }

    return NextResponse.json({
      success: true,
      tables: [
        "users",
        "sessions",
        "pmx_trades",
        "trademc_companies",
        "trademc_trades",
        "trademc_weight_transactions",
        "account_opening_balances",
        "sync_jobs",
      ],
      adminSeeded,
      message: adminSeeded
        ? "Database initialized. Admin user created (username: admin, password: admin). Change the password after first login."
        : "Database initialized. Admin user already exists.",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      {
        error: "Setup failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
