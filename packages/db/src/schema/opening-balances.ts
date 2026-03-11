import {
  pgTable,
  serial,
  text,
  numeric,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const accountOpeningBalances = pgTable(
  "account_opening_balances",
  {
    id: serial("id").primaryKey(),
    month: text("month").notNull(), // YYYY-MM
    currency: text("currency").notNull(), // XAU, USD, ZAR
    openingBalance: numeric("opening_balance", {
      precision: 18,
      scale: 6,
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_opening_balance_month_currency").on(t.month, t.currency),
  ]
);
