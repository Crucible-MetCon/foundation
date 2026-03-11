import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const trademcCompanies = pgTable(
  "trademc_companies",
  {
    id: serial("id").primaryKey(),
    directusId: integer("directus_id").unique().notNull(),
    companyName: text("company_name").notNull(),
    status: text("status"),
    registrationNumber: text("registration_number"),
    contactNumber: text("contact_number"),
    emailAddress: text("email_address"),
    tradeLimit: numeric("trade_limit", { precision: 18, scale: 4 }),
    blocked: boolean("blocked").default(false),
    vatNumber: text("vat_number"),
    evoCustomerCode: text("evo_customer_code"),
    refiningRate: numeric("refining_rate", { precision: 8, scale: 4 }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_tmc_company_name").on(t.companyName)]
);

export const trademcTrades = pgTable(
  "trademc_trades",
  {
    id: serial("id").primaryKey(),
    directusId: integer("directus_id").unique().notNull(),
    status: text("status"),
    companyId: integer("company_id"),
    weight: numeric("weight", { precision: 18, scale: 8 }), // grams
    notes: text("notes"),
    refNumber: text("ref_number"), // Trade number link
    tradeTimestamp: timestamp("trade_timestamp", { withTimezone: true }),
    zarPerTroyOunce: numeric("zar_per_troy_ounce", {
      precision: 18,
      scale: 6,
    }),
    zarToUsd: numeric("zar_to_usd", { precision: 18, scale: 8 }),
    requestedZarPerGram: numeric("requested_zar_per_gram", {
      precision: 18,
      scale: 6,
    }),
    zarPerTroyOunceConfirmed: numeric("zar_per_troy_ounce_confirmed", {
      precision: 18,
      scale: 6,
    }),
    zarToUsdConfirmed: numeric("zar_to_usd_confirmed", {
      precision: 18,
      scale: 8,
    }),
    usdPerTroyOunceConfirmed: numeric("usd_per_troy_ounce_confirmed", {
      precision: 18,
      scale: 6,
    }),
    evoExported: boolean("evo_exported").default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_tmc_company").on(t.companyId),
    index("idx_tmc_ref_number").on(t.refNumber),
    index("idx_tmc_status").on(t.status),
    index("idx_tmc_timestamp").on(t.tradeTimestamp),
  ]
);

export const trademcWeightTransactions = pgTable(
  "trademc_weight_transactions",
  {
    id: serial("id").primaryKey(),
    directusId: integer("directus_id").unique().notNull(),
    companyId: integer("company_id"),
    tradeId: integer("trade_id"),
    type: text("type").notNull(), // CREDIT, DEBIT, TRADE, etc.
    weight: numeric("weight", { precision: 18, scale: 8 }),
    goldPercentage: numeric("gold_percentage", { precision: 8, scale: 4 }),
    rollingBalance: numeric("rolling_balance", { precision: 18, scale: 8 }),
    notes: text("notes"),
    pcCode: text("pc_code"),
    transactionTimestamp: timestamp("transaction_timestamp", {
      withTimezone: true,
    }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_tmc_wt_company").on(t.companyId),
    index("idx_tmc_wt_type").on(t.type),
    index("idx_tmc_wt_timestamp").on(t.transactionTimestamp),
  ]
);
